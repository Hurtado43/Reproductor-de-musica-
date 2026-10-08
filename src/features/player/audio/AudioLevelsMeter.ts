import type { OrbAudioInput, OrbAudioLevels } from '../visualizer/orbAudio';
import { AudioLevelAnalyzer, zeroLevels, type AnalyserLike } from './audioAnalysis';
import type { PlaybackSnapshot } from './AudioEngine';

export interface FrameScheduler {
  requestAnimationFrame(callback: () => void): unknown;
  cancelAnimationFrame(handle: unknown): void;
}

function browserScheduler(): FrameScheduler {
  return {
    requestAnimationFrame: (callback) =>
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(callback)
        : globalThis.setTimeout(callback, 16),
    cancelAnimationFrame: (handle) => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle as number);
      else globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

/** Lo que el medidor necesita del motor (`AudioEngine` lo cumple). */
export interface MeterSource {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PlaybackSnapshot;
  readonly outputGraph: {
    readonly analyser: AnalyserLike | null;
    readonly running: boolean;
    readonly context: { readonly sampleRate: number; readonly currentTime: number };
  } | null;
}

/**
 * Único bucle de análisis: mientras el motor confirma "Reproduciendo" y existe
 * un analizador en la ruta de salida, lee el `AnalyserNode` una vez por
 * fotograma (`requestAnimationFrame`) y escribe los niveles en `input.current`,
 * el objeto estable que recibe `Visualizer`. Sin estado de React.
 *
 * - En pausa, final, error, carga de otra canción o sin canción: cancela el
 *   fotograma pendiente, escribe 0 y `active: false` (la esfera vuelve a su
 *   forma redonda y se detiene).
 * - Al (re)empezar descarta una ventana de análisis (`fftSize / sampleRate`:
 *   46,4 ms a 44,1 kHz, 42,7 ms a 48 kHz) medida con el reloj del
 *   `AudioContext`: el analizador no conserva
 *   muestras de la canción anterior ni de antes de la pausa.
 * - Sin Web Audio (o con la ruta de reserva sin analizador) no hay bucle.
 * - No multiplica por el volumen: el analizador ya recibe la señal atenuada
 *   por `volume`/`muted` del elemento (comprobado en Chromium, ver docs).
 * - Fase 5: `input.current.active` es `true` solo mientras hay reproducción
 *   confirmada, el contexto está en marcha y ya hay datos reales (pasada la
 *   ventana descartada). La esfera solo se deforma en ese caso; si no, vuelve a
 *   la esfera y se detiene.
 */
export class AudioLevelsMeter {
  readonly #source: MeterSource;
  readonly #scheduler: FrameScheduler;
  readonly #analyzer = new AudioLevelAnalyzer();
  readonly #levels: OrbAudioLevels = { energy: 0, bass: 0, treble: 0, active: false };
  /** Entrada estable para la esfera (misma referencia durante toda la vida). */
  readonly input: OrbAudioInput = { current: this.#levels };
  #frame: unknown = null;
  #ignoreUntil = 0;
  #unsubscribe: (() => void) | null = null;

  constructor(source: MeterSource, scheduler: Partial<FrameScheduler> = {}) {
    this.#source = source;
    this.#scheduler = { ...browserScheduler(), ...scheduler };
  }

  /** `true` mientras hay un fotograma de análisis programado. */
  get running(): boolean {
    return this.#frame !== null;
  }

  /** Empieza a seguir al motor. Devuelve la limpieza (idempotente; segura en Strict Mode). */
  connect(): () => void {
    this.disconnect();
    const unsubscribe = this.#source.subscribe(this.#update);
    this.#unsubscribe = unsubscribe;
    this.#update();
    return () => {
      if (this.#unsubscribe === unsubscribe) this.disconnect();
    };
  }

  /** Deja de seguir al motor, cancela el fotograma pendiente y pone los niveles a 0. */
  disconnect(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#stop();
  }

  readonly #update = (): void => {
    const graph = this.#source.outputGraph;
    const active =
      this.#source.getSnapshot().status === 'playing' && graph !== null && graph.analyser !== null;
    if (active) this.#start();
    else this.#stop();
  };

  #start(): void {
    if (this.#frame !== null) return;
    const graph = this.#source.outputGraph;
    if (graph && graph.analyser) {
      const { sampleRate, currentTime } = graph.context;
      this.#ignoreUntil = sampleRate > 0 ? currentTime + graph.analyser.fftSize / sampleRate : 0;
    }
    this.#frame = this.#scheduler.requestAnimationFrame(this.#tick);
  }

  #stop(): void {
    if (this.#frame !== null) {
      this.#scheduler.cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#idle();
  }

  /** Sin señal real disponible: niveles a 0 y la esfera vuelve al reposo. */
  #idle(): void {
    zeroLevels(this.#levels);
    this.#levels.active = false;
  }

  readonly #tick = (): void => {
    this.#frame = null;
    const graph = this.#source.outputGraph;
    const analyser = graph?.analyser ?? null;
    if (!graph || !analyser || this.#source.getSnapshot().status !== 'playing') {
      this.#idle();
      return;
    }
    if (!graph.running || graph.context.currentTime < this.#ignoreUntil) {
      this.#idle();
    } else {
      this.#analyzer.measure(analyser, graph.context.sampleRate, this.#levels);
      this.#levels.active = true;
    }
    this.#frame = this.#scheduler.requestAnimationFrame(this.#tick);
  };
}
