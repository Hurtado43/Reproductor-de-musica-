import type {
  AnalyserNodeLike,
  AudioContextLike,
  AudioNodeLike,
} from '../../src/features/player/audio/audioGraph';
import { FakeDomException, type FakeMedia } from './fakeMedia';

/*
 * `AudioContext`, `MediaElementAudioSourceNode` y `AnalyserNode` SIMULADOS.
 * No procesan sonido. Imitan lo que importa del navegador:
 * - `createMediaElementSource` lanza `InvalidStateError` si el elemento ya
 *   tiene un nodo fuente (en cualquier contexto), como Chromium.
 * - `resume()` queda pendiente hasta que la prueba lo resuelve o rechaza
 *   (`resolveResume` / `rejectResume`), salvo con `autoResume`.
 * - El analizador devuelve la señal que la prueba fija (`signal`), atenuada
 *   por `volume` y `muted` del elemento conectado, como se midió en Chromium
 *   (docs/progreso.md, fase 3B). Si no hay ruta fuente → analizador, silencio.
 * - Registra las conexiones (`edges`) para comprobar que hay una sola ruta.
 */

/** Elementos que ya tienen nodo fuente (en cualquier contexto simulado). */
const elementsWithSource = new WeakSet<object>();

export interface FakeSignal {
  /** Muestras temporales (se repiten hasta llenar el buffer). */
  time: Float32Array;
  /** dB por bin (longitud `frequencyBinCount`). */
  freqDb: Float32Array;
}

class FakeNode implements AudioNodeLike {
  disconnectCalls = 0;
  constructor(
    readonly kind: 'source' | 'analyser' | 'destination',
    readonly ctx: FakeAudioContext,
  ) {}

  connect(destination: AudioNodeLike): AudioNodeLike {
    const target = destination as FakeNode;
    if (this.ctx.failConnect?.(this.kind, target.kind)) {
      throw new FakeDomException('InvalidAccessError');
    }
    this.ctx.edges.push(`${this.kind}->${target.kind}`);
    return destination;
  }

  disconnect(): void {
    this.disconnectCalls++;
    this.ctx.edges = this.ctx.edges.filter((edge) => !edge.startsWith(`${this.kind}->`));
  }
}

export class FakeSourceNode extends FakeNode {
  constructor(
    ctx: FakeAudioContext,
    readonly element: FakeMedia,
  ) {
    super('source', ctx);
  }
}

export class FakeAnalyser extends FakeNode implements AnalyserNodeLike {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  timeCalls = 0;
  freqCalls = 0;
  /** Arreglos recibidos (para comprobar que se reutilizan). */
  readonly receivedArrays = new Set<Float32Array>();

  constructor(ctx: FakeAudioContext) {
    super('analyser', ctx);
  }

  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }

  /** Ganancia que llega al analizador: 0 sin ruta, `muted` o volumen del elemento. */
  #gain(): number {
    const source = this.ctx.source;
    if (!source || !this.ctx.edges.includes('source->analyser')) return 0;
    if (source.element.muted || source.element.paused) return 0;
    return source.element.volume;
  }

  getFloatTimeDomainData(array: Float32Array<ArrayBuffer>): void {
    this.timeCalls++;
    this.receivedArrays.add(array);
    const gain = this.#gain();
    const signal = this.ctx.signal;
    for (let i = 0; i < array.length; i++) {
      array[i] = signal && signal.time.length > 0 ? signal.time[i % signal.time.length]! * gain : 0;
    }
  }

  getFloatFrequencyData(array: Float32Array<ArrayBuffer>): void {
    this.freqCalls++;
    this.receivedArrays.add(array);
    const gain = this.#gain();
    const offset = gain > 0 ? 20 * Math.log10(gain) : -Infinity;
    const signal = this.ctx.signal;
    for (let i = 0; i < array.length; i++) {
      array[i] = signal ? (signal.freqDb[i] ?? -Infinity) + offset : -Infinity;
    }
  }
}

interface FakeContextOptions {
  initialState?: 'suspended' | 'running';
  sampleRate?: number;
  /** `resume()` se resuelve sola (y pone el estado en `running`). */
  autoResume?: boolean;
  failAnalyser?: boolean;
  failCreateSource?: boolean;
  failConnect?: (from: string, to: string) => boolean;
  closeRejects?: boolean;
}

interface PendingResume {
  resolve(): void;
  reject(error: unknown): void;
}

export class FakeAudioContext implements AudioContextLike {
  state: string;
  readonly sampleRate: number;
  currentTime = 0;
  readonly destination: FakeNode;
  edges: string[] = [];
  source: FakeSourceNode | null = null;
  analyser: FakeAnalyser | null = null;
  signal: FakeSignal | null = null;
  readonly failConnect: FakeContextOptions['failConnect'];
  readonly #options: FakeContextOptions;
  readonly #listeners = new Set<() => void>();
  pendingResumes: PendingResume[] = [];
  resumeCalls = 0;
  closeCalls = 0;
  sourceCalls = 0;

  constructor(options: FakeContextOptions = {}) {
    this.#options = options;
    this.state = options.initialState ?? 'suspended';
    this.sampleRate = options.sampleRate ?? 48000;
    this.failConnect = options.failConnect;
    this.destination = new FakeNode('destination', this);
  }

  createMediaElementSource(element: unknown): AudioNodeLike {
    this.sourceCalls++;
    if (this.#options.failCreateSource) throw new FakeDomException('NotSupportedError');
    if (elementsWithSource.has(element as object)) throw new FakeDomException('InvalidStateError');
    elementsWithSource.add(element as object);
    this.source = new FakeSourceNode(this, element as FakeMedia);
    return this.source;
  }

  createAnalyser(): AnalyserNodeLike {
    if (this.#options.failAnalyser) throw new FakeDomException('NotSupportedError');
    this.analyser = new FakeAnalyser(this);
    return this.analyser;
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.state === 'closed') return Promise.reject(new FakeDomException('InvalidStateError'));
    if (this.#options.autoResume || this.state === 'running') {
      this.#setState('running');
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => this.pendingResumes.push({ resolve, reject }));
  }

  close(): Promise<void> {
    this.closeCalls++;
    this.#setState('closed');
    return this.#options.closeRejects
      ? Promise.reject(new FakeDomException('InvalidStateError'))
      : Promise.resolve();
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.#listeners.add(listener);
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.#listeners.delete(listener);
  }

  listenerCount(): number {
    return this.#listeners.size;
  }

  /** Resuelve el `resume()` más antiguo (el contexto pasa a `running`). */
  resolveResume(): void {
    this.#setState('running');
    this.pendingResumes.shift()?.resolve();
  }

  rejectResume(name = 'InvalidStateError'): void {
    this.pendingResumes.shift()?.reject(new FakeDomException(name));
  }

  /** El sistema suspende o cierra el contexto (ajeno al motor). */
  systemSetState(state: 'suspended' | 'interrupted' | 'closed'): void {
    this.#setState(state);
  }

  /** Avanza el reloj del contexto. */
  advance(seconds: number): void {
    this.currentTime += seconds;
  }

  #setState(state: string): void {
    if (this.state === state) return;
    this.state = state;
    for (const listener of [...this.#listeners]) listener();
  }
}

/** Fábrica que registra todos los contextos creados. */
export function fakeAudioContextFactory(options: FakeContextOptions = {}) {
  const contexts: FakeAudioContext[] = [];
  return {
    contexts,
    create: (): AudioContextLike => {
      const ctx = new FakeAudioContext(options);
      contexts.push(ctx);
      return ctx;
    },
    last: () => contexts[contexts.length - 1]!,
  };
}

/** Tono de prueba: `amplitude · sin(2π f t)` y su espectro aproximado en un bin. */
export function toneSignal(
  frequencyHz: number,
  amplitude: number,
  sampleRate = 48000,
  fftSize = 2048,
): FakeSignal {
  const time = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) time[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  const freqDb = new Float32Array(fftSize / 2).fill(-Infinity);
  // Toda la potencia en el bin más cercano, calibrada como RMS en dBFS menos
  // la corrección de la ventana (ver BAND_POWER_TO_RMS_DB).
  const bin = Math.round(frequencyHz / (sampleRate / fftSize));
  const rmsDb = 20 * Math.log10(amplitude / Math.SQRT2);
  freqDb[bin] = rmsDb - 8.17;
  return { time, freqDb };
}
