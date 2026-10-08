import { ANALYSIS_CONFIG, type AnalyserLike } from './audioAnalysis';

/**
 * Ruta de salida por Web Audio (capa cliente, sin React).
 *
 *   elemento → MediaElementAudioSourceNode → AnalyserNode → destination
 *
 * Es la ÚNICA ruta audible una vez creado el nodo fuente: el navegador deja
 * de enviar el elemento a los altavoces por su cuenta. No hay otra conexión
 * directa a `destination` (salvo la ruta de reserva sin análisis de
 * `connectFallback`, que sustituye a la principal y nunca coexiste con ella).
 *
 * Propiedad: la crea y la libera `AudioEngine`, junto con su elemento. Un
 * elemento tiene como mucho un nodo fuente en toda su vida; si el contexto se
 * cierra, el elemento ya no se reutiliza (el motor crea otro).
 */

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}

export interface AnalyserNodeLike extends AudioNodeLike, AnalyserLike {
  fftSize: number;
  smoothingTimeConstant: number;
}

/** Lo que el motor usa de `AudioContext` (se simula en las pruebas). */
export interface AudioContextLike {
  readonly state: string;
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  /** Recibe el elemento del motor (un `HTMLAudioElement` en el navegador). */
  createMediaElementSource(element: unknown): AudioNodeLike;
  createAnalyser(): AnalyserNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

/** Fallo al montar la ruta. `routed` dice si el elemento ya quedó redirigido. */
export class AudioGraphError extends Error {
  constructor(
    message: string,
    readonly routed: boolean,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AudioGraphError';
  }
}

/** Ignora el resultado de `close()`; nunca deja un rechazo sin capturar. */
function closeQuietly(context: AudioContextLike): void {
  if (context.state === 'closed') return;
  try {
    context.close().catch(() => {});
  } catch {
    // close() puede lanzar de forma síncrona en entornos antiguos.
  }
}

export class AudioOutputGraph {
  readonly context: AudioContextLike;
  readonly #source: AudioNodeLike;
  readonly #analyser: AnalyserNodeLike;
  /** `true` si la ruta principal (con analizador) está conectada. */
  #analysing: boolean;
  #disposed = false;
  readonly #onStateChange: () => void;

  /**
   * Monta la ruta sobre `element`.
   * - Antes de crear el nodo fuente (analizador, contexto) un fallo deja el
   *   elemento intacto: `AudioGraphError` con `routed = false` y el contexto cerrado.
   * - Después, si no se puede conectar el analizador, intenta la ruta de
   *   reserva `fuente → destination`; si tampoco, `routed = true`: el elemento
   *   ya no suena por sí solo y el motor debe sustituirlo.
   */
  static create(
    context: AudioContextLike,
    element: unknown,
    onStateChange: (graph: AudioOutputGraph) => void,
  ): AudioOutputGraph {
    let analyser: AnalyserNodeLike;
    let source: AudioNodeLike;
    try {
      analyser = context.createAnalyser();
      analyser.fftSize = ANALYSIS_CONFIG.fftSize;
      // Sin suavizado propio del nodo: el único suavizado es el de la esfera, y
      // así no se mezcla el espectro de una canción anterior con el nuevo.
      analyser.smoothingTimeConstant = 0;
      source = context.createMediaElementSource(element);
    } catch (cause) {
      closeQuietly(context);
      throw new AudioGraphError('No se pudo preparar el análisis de audio.', false, cause);
    }

    let analysing = true;
    try {
      source.connect(analyser);
      analyser.connect(context.destination);
    } catch (cause) {
      analysing = false;
      try {
        source.disconnect();
        analyser.disconnect();
        source.connect(context.destination); // ruta de reserva audible, sin análisis
      } catch (fallbackCause) {
        closeQuietly(context);
        throw new AudioGraphError('No se pudo conectar la salida de audio.', true, fallbackCause ?? cause);
      }
    }
    return new AudioOutputGraph(context, source, analyser, analysing, onStateChange);
  }

  private constructor(
    context: AudioContextLike,
    source: AudioNodeLike,
    analyser: AnalyserNodeLike,
    analysing: boolean,
    onStateChange: (graph: AudioOutputGraph) => void,
  ) {
    this.context = context;
    this.#source = source;
    this.#analyser = analyser;
    this.#analysing = analysing;
    this.#onStateChange = () => {
      if (!this.#disposed) onStateChange(this);
    };
    context.addEventListener('statechange', this.#onStateChange);
  }

  /** Analizador de la ruta principal, o `null` (ruta de reserva o liberado). */
  get analyser(): AnalyserNodeLike | null {
    return this.#analysing && !this.#disposed ? this.#analyser : null;
  }

  get running(): boolean {
    return !this.#disposed && this.context.state === 'running';
  }

  /** `true` si el contexto se cerró sin que lo liberáramos: la ruta ya no suena. */
  get broken(): boolean {
    return !this.#disposed && this.context.state === 'closed';
  }

  /** Desconecta los nodos y cierra el contexto (una sola vez, sin rechazos sueltos). */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#analysing = false;
    this.context.removeEventListener('statechange', this.#onStateChange);
    for (const node of [this.#source, this.#analyser]) {
      try {
        node.disconnect();
      } catch {
        // Ya desconectado.
      }
    }
    closeQuietly(this.context);
  }
}
