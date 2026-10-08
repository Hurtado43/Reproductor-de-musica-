/**
 * Motor de reproducción (capa cliente, sin React).
 *
 * - Un solo `HTMLAudioElement` por instancia, creado de forma diferida y solo
 *   en el navegador (la primera vez que se carga una canción).
 * - No conoce el orden ni la selección: recibe qué canción cargar (id + `File`)
 *   y avisa cuando termina. El orden y la selección pertenecen a `Playlist`.
 * - El elemento es la fuente de verdad: `currentTime`, `duration`, `paused`,
 *   `ended` y sus eventos. No hay temporizadores que simulen el progreso.
 * - Cada carga tiene una versión (`#sourceVersion`) y cada intención de
 *   reproducir o pausar otra (`#playVersion`). Las respuestas de `play()` y los
 *   eventos de una fuente anterior se descartan si su versión ya no es la actual.
 * - Los listeners se registran por fuente y se quitan al sustituirla.
 *
 * Fase 3B: ruta de salida por Web Audio (`AudioOutputGraph`), propiedad del motor:
 * - El `AudioContext` y el `MediaElementAudioSourceNode` se crean de forma
 *   diferida al primer intento de reproducir (un gesto del usuario), una sola
 *   vez por elemento: no se recrean al cambiar de canción, pausar o renderizar.
 * - Ruta única: fuente → analizador → destination.
 * - Si el contexto no está en marcha, se espera `resume()` antes de `play()`.
 *   Esa espera tiene las mismas versiones que `play()`: si el usuario pausa,
 *   cambia de canción, elimina la actual o se desmonta, la respuesta antigua no
 *   reproduce nada.
 * - Sin Web Audio (o si falla antes de redirigir el elemento) se usa la ruta
 *   convencional del elemento. Si falla después, el elemento ya no suena por sí
 *   solo: se muestra un error recuperable y, al reproducir, se sustituye por un
 *   elemento nuevo con la ruta convencional.
 * - `dispose()` libera la fuente, desconecta los nodos y cierra el contexto.
 *   Un montaje posterior (Strict Mode) crea elemento, contexto y fuente nuevos:
 *   nunca reutiliza un nodo fuente de un contexto cerrado.
 */

import { AudioGraphError, AudioOutputGraph, type AudioContextLike } from './audioGraph';

export type PlaybackStatus =
  | 'empty'
  | 'loading'
  | 'paused'
  | 'playing'
  | 'buffering'
  | 'ended'
  | 'error';

export type PlaybackErrorKind =
  | 'blocked'
  | 'missing-source'
  | 'load'
  | 'decode'
  | 'unsupported'
  | 'play'
  /** La salida de Web Audio no se pudo activar o se interrumpió (recuperable). */
  | 'output';

export interface PlaybackError {
  readonly kind: PlaybackErrorKind;
  readonly message: string;
}

/** Estado publicado para la interfaz (objeto nuevo en cada cambio). */
export interface PlaybackSnapshot {
  /** Canción cargada en el elemento, o `null`. */
  readonly songId: string | null;
  readonly status: PlaybackStatus;
  /** `currentTime` del elemento, en segundos. */
  readonly currentTime: number;
  /** `duration` del elemento (precisa), o `null` si aún no se conoce. */
  readonly duration: number | null;
  /** Volumen elegido (0–1). Se conserva al silenciar. */
  readonly volume: number;
  readonly muted: boolean;
  /** `true` si el usuario quiere que suene (incluye la espera de `play()`). */
  readonly wantsToPlay: boolean;
  readonly error: PlaybackError | null;
}

/** Lo que el motor usa de `HTMLAudioElement` (se simula en las pruebas). */
export interface MediaElementLike {
  src: string;
  preload: string;
  currentTime: number;
  volume: number;
  muted: boolean;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly error: { readonly code: number } | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface PlaybackEnvironment {
  createElement(): MediaElementLike;
  createObjectURL(file: Blob): string;
  revokeObjectURL(url: string): void;
  /** Un `AudioContext` nuevo, o `null` si Web Audio no está disponible. */
  createAudioContext(): AudioContextLike | null;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

function browserEnvironment(): PlaybackEnvironment {
  return {
    createElement: () => document.createElement('audio'),
    createObjectURL: (file) => URL.createObjectURL(file),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAudioContext: () => {
      if (typeof window === 'undefined') return null;
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return Ctor ? (new Ctor() as unknown as AudioContextLike) : null;
    },
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

/** Tiempo máximo de espera de `AudioContext.resume()` antes de mostrar un error. */
export const RESUME_TIMEOUT_MS = 4000;

const OUTPUT_START_MESSAGE = 'No se pudo activar la salida de audio. Pulsa Reproducir para reintentar.';
const OUTPUT_SUSPENDED_MESSAGE = 'La salida de audio se suspendió. Pulsa Reproducir para continuar.';
const OUTPUT_LOST_MESSAGE = 'La salida de audio se interrumpió. Pulsa Reproducir para continuar.';

const MEDIA_ERROR_MESSAGES: Record<number, { kind: PlaybackErrorKind; message: string }> = {
  1: { kind: 'load', message: 'La carga del audio se interrumpió.' },
  2: { kind: 'load', message: 'No se pudo leer el archivo de audio.' },
  3: { kind: 'decode', message: 'El audio no se pudo decodificar (el archivo puede estar dañado).' },
  4: { kind: 'unsupported', message: 'El navegador no puede reproducir este archivo.' },
};

export const BLOCKED_MESSAGE =
  'El navegador no permitió iniciar el sonido automáticamente. Pulsa Reproducir para empezar.';

interface LoadedSource {
  readonly songId: string;
  readonly file: File;
  readonly url: string;
  readonly version: number;
  /** Quita los listeners de esta fuente. */
  readonly detach: () => void;
  endedHandled: boolean;
}

const SOURCE_EVENTS = [
  'loadedmetadata',
  'durationchange',
  'canplay',
  'timeupdate',
  'seeked',
  'playing',
  'pause',
  'waiting',
  'ended',
  'error',
  'volumechange',
] as const;

export class AudioEngine {
  readonly #env: PlaybackEnvironment;
  #element: MediaElementLike | null = null;
  #source: LoadedSource | null = null;
  #sourceVersion = 0;
  #playVersion = 0;
  /** Versión del `play()` pendiente de confirmar, o `null`. */
  #pendingPlay: number | null = null;
  #volume = 1;
  #muted = false;
  #state: PlaybackSnapshot;
  readonly #listeners = new Set<() => void>();
  #onEnded: ((songId: string) => void) | null = null;
  /** Ruta de Web Audio del elemento actual, o `null`. */
  #graph: AudioOutputGraph | null = null;
  /** `false` tras un fallo o sin Web Audio: este motor usa la ruta convencional. */
  #webAudioEnabled = true;
  /** El elemento quedó redirigido a un grafo que ya no suena: hay que sustituirlo. */
  #routeLost = false;
  #resumeTimer: unknown = null;

  constructor(environment: Partial<PlaybackEnvironment> = {}) {
    this.#env = { ...browserEnvironment(), ...environment };
    this.#state = this.#emptyState();
  }

  // ---------- Suscripción (useSyncExternalStore) ----------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): PlaybackSnapshot => this.#state;

  /** Elemento de audio actual, o `null`. */
  get mediaElement(): MediaElementLike | null {
    return this.#element;
  }

  /** Ruta de Web Audio (contexto y analizador), o `null` si no existe o no hay Web Audio. */
  get outputGraph(): AudioOutputGraph | null {
    return this.#graph;
  }

  get songId(): string | null {
    return this.#source?.songId ?? null;
  }

  /** `true` si el usuario quiere que suene: decide si una nueva canción arranca sola. */
  get wantsToPlay(): boolean {
    return this.#state.wantsToPlay;
  }

  /** Se llama una sola vez por carga cuando la canción termina (`ended`). */
  setEndedHandler(handler: ((songId: string) => void) | null): void {
    this.#onEnded = handler;
  }

  // ---------- Fuente ----------

  /**
   * Detiene la fuente anterior y carga `file` desde el inicio.
   * Con `autoplay` intenta reproducir; si no, queda en pausa.
   * Sin `file` (fuente inexistente) muestra el error correspondiente.
   */
  load(
    songId: string,
    file: File | null,
    { autoplay, startTime = 0 }: { autoplay: boolean; startTime?: number },
  ): void {
    this.#releaseSource();
    const version = ++this.#sourceVersion;
    this.#playVersion++;
    this.#cancelPendingPlay();
    if (this.#routeLost) this.#discardElement();

    if (file === null) {
      this.#setState({
        ...this.#emptyState(),
        songId,
        status: 'error',
        error: { kind: 'missing-source', message: 'No se encontró el archivo de esta canción.' },
      });
      return;
    }

    const element = this.#ensureElement();
    let url: string;
    try {
      url = this.#env.createObjectURL(file);
    } catch {
      this.#setState({
        ...this.#emptyState(),
        songId,
        status: 'error',
        error: { kind: 'load', message: 'No se pudo preparar el archivo de audio.' },
      });
      return;
    }

    const handlers = this.#createHandlers(version);
    for (const type of SOURCE_EVENTS) element.addEventListener(type, handlers[type]);
    const detach = () => {
      for (const type of SOURCE_EVENTS) element.removeEventListener(type, handlers[type]);
    };

    // El objeto se guarda en `#source` y luego se marca `endedHandled`: no es readonly.
    this.#source = { songId, file, url, version, detach, endedHandled: false };
    element.preload = 'auto';
    element.src = url;
    if (Number.isFinite(startTime) && startTime > 0) element.currentTime = startTime;

    this.#setState({
      ...this.#emptyState(),
      songId,
      status: 'loading',
      wantsToPlay: autoplay,
    });
    if (autoplay) this.#startPlayback();
  }

  /** Detiene y descarga el audio. Limpia tiempos, selección cargada y errores. */
  unload(): void {
    this.#releaseSource();
    this.#sourceVersion++;
    this.#playVersion++;
    this.#cancelPendingPlay();
    this.#setState(this.#emptyState());
  }

  /**
   * Libera todo (desmontaje): la fuente (listeners, `src`, URL), los nodos y el
   * `AudioContext`. La instancia puede volver a usarse: crearía elemento,
   * contexto y nodo fuente nuevos, nunca los de un contexto cerrado.
   */
  dispose(): void {
    this.unload();
    this.#discardElement();
    this.#webAudioEnabled = true;
  }

  // ---------- Transporte ----------

  /** Reproduce. Si la canción terminó, empieza desde cero; si falló, la vuelve a cargar. */
  play(): void {
    const source = this.#source;
    if (!source) return;
    const kind = this.#state.error?.kind;
    if (this.#state.status === 'error' && kind !== 'blocked' && kind !== 'output') {
      this.load(source.songId, source.file, { autoplay: true });
      return;
    }
    this.#startPlayback();
  }

  /** Pausa y conserva `currentTime`. Invalida un `play()` pendiente. */
  pause(): void {
    this.#playVersion++;
    this.#cancelPendingPlay();
    const element = this.#element;
    if (!this.#source || !element) return;
    element.pause();
    const status = this.#state.status;
    this.#setState({
      wantsToPlay: false,
      status: status === 'ended' || status === 'error' ? status : 'paused',
      currentTime: element.currentTime,
    });
  }

  togglePlay(): void {
    if (this.#state.wantsToPlay) this.pause();
    else this.play();
  }

  /**
   * Cambia la posición. Ignora valores no finitos y limita a [0, duración].
   * Conserva el estado de reproducción o pausa.
   * @returns `true` si se aplicó.
   */
  seek(seconds: number): boolean {
    const element = this.#element;
    if (!element || !this.#source || !Number.isFinite(seconds)) return false;
    const duration = element.duration;
    if (!Number.isFinite(duration) || duration <= 0) return false;
    const target = Math.min(Math.max(seconds, 0), duration);
    element.currentTime = target;
    const wasEnded = this.#state.status === 'ended';
    this.#setState({
      currentTime: target,
      ...(wasEnded && target < duration ? { status: 'paused' as const } : {}),
    });
    if (wasEnded && this.#source) this.#source.endedHandled = false;
    return true;
  }

  /** Volumen 0–1 (se ignoran valores no finitos). */
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.#volume = Math.min(Math.max(volume, 0), 1);
    if (this.#element) this.#element.volume = this.#volume;
    this.#setState({ volume: this.#volume });
  }

  /** Silencio con `muted`: el volumen elegido se conserva. */
  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#element) this.#element.muted = muted;
    this.#setState({ muted });
  }

  // ---------- Interno ----------

  #emptyState(): PlaybackSnapshot {
    return {
      songId: null,
      status: 'empty',
      currentTime: 0,
      duration: null,
      volume: this.#volume,
      muted: this.#muted,
      wantsToPlay: false,
      error: null,
    };
  }

  #setState(patch: Partial<PlaybackSnapshot>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener();
  }

  #ensureElement(): MediaElementLike {
    if (!this.#element) {
      const element = this.#env.createElement();
      element.preload = 'auto';
      element.volume = this.#volume;
      element.muted = this.#muted;
      this.#element = element;
    }
    return this.#element;
  }

  /**
   * Ruta de Web Audio del elemento: la crea una sola vez (por elemento) y la
   * reutiliza en todas las canciones. `null` = ruta convencional del elemento.
   */
  #ensureGraph(element: MediaElementLike): AudioOutputGraph | null {
    if (this.#graph) return this.#graph;
    if (!this.#webAudioEnabled) return null;
    let context: AudioContextLike | null = null;
    try {
      context = this.#env.createAudioContext();
    } catch {
      context = null;
    }
    if (!context) {
      this.#webAudioEnabled = false; // sin Web Audio: reproducción convencional
      return null;
    }
    try {
      this.#graph = AudioOutputGraph.create(context, element, this.#handleGraphState);
    } catch (error) {
      this.#webAudioEnabled = false;
      // Antes de crear el nodo fuente el elemento sigue sonando por su cuenta.
      // Después, ya no: hay que sustituirlo.
      if (error instanceof AudioGraphError && error.routed) this.#routeLost = true;
      return null;
    }
    return this.#graph;
  }

  /** Cambios de estado del `AudioContext` ajenos al motor. */
  readonly #handleGraphState = (graph: AudioOutputGraph): void => {
    if (graph !== this.#graph) return;
    if (graph.broken) {
      // Contexto cerrado: el elemento sigue redirigido a un grafo mudo.
      graph.dispose();
      this.#graph = null;
      this.#webAudioEnabled = false;
      this.#routeLost = true;
      if (this.#state.wantsToPlay) this.#failOutput(OUTPUT_LOST_MESSAGE);
      return;
    }
    // Suspendido o interrumpido por el sistema mientras sonaba (no durante resume()).
    if (!graph.running && this.#state.wantsToPlay && this.#pendingPlay === null) {
      this.#failOutput(OUTPUT_SUSPENDED_MESSAGE);
    }
  };

  /** Error recuperable de la salida: detiene, invalida intenciones y espera a Reproducir. */
  #failOutput(message: string): void {
    this.#playVersion++;
    this.#cancelPendingPlay();
    const element = this.#element;
    if (!this.#source || !element) return;
    element.pause();
    this.#setState({
      wantsToPlay: false,
      status: 'paused',
      currentTime: element.currentTime,
      error: { kind: 'output', message },
    });
  }

  /**
   * El elemento quedó conectado a un grafo que ya no suena. Desconectar el nodo
   * no devuelve la salida convencional, así que se crea un elemento nuevo (sin
   * Web Audio) y se vuelve a cargar la canción en el mismo punto.
   */
  #replaceLostElement(): void {
    const source = this.#source;
    if (!source) {
      this.#discardElement();
      return;
    }
    const element = this.#element;
    const startTime = element && !element.ended ? element.currentTime : 0;
    this.load(source.songId, source.file, { autoplay: true, startTime });
  }

  /** Suelta el elemento y su grafo (desconecta y cierra el contexto). */
  #discardElement(): void {
    this.#graph?.dispose();
    this.#graph = null;
    this.#element = null;
    this.#routeLost = false;
  }

  #cancelPendingPlay(): void {
    this.#pendingPlay = null;
    this.#clearResumeTimer();
  }

  #clearResumeTimer(): void {
    if (this.#resumeTimer === null) return;
    this.#env.clearTimeout(this.#resumeTimer);
    this.#resumeTimer = null;
  }

  /** Quita listeners, detiene, desvincula el `src` y después revoca la URL. */
  #releaseSource(): void {
    const source = this.#source;
    const element = this.#element;
    if (!source) return;
    this.#source = null;
    source.detach();
    if (element) {
      element.pause();
      element.removeAttribute('src');
      try {
        element.load();
      } catch {
        // Algunos entornos no implementan load(); el src ya está desvinculado.
      }
    }
    this.#env.revokeObjectURL(source.url);
  }

  #startPlayback(): void {
    if (this.#routeLost) {
      this.#replaceLostElement();
      return;
    }
    const element = this.#element;
    const source = this.#source;
    if (!element || !source) return;
    const playVersion = ++this.#playVersion;
    const sourceVersion = this.#sourceVersion;
    this.#cancelPendingPlay();
    this.#pendingPlay = playVersion;

    if (this.#state.status === 'ended' || element.ended) {
      element.currentTime = 0;
      source.endedHandled = false;
    }
    this.#setState({
      wantsToPlay: true,
      status: this.#state.status === 'playing' ? 'playing' : 'loading',
      error: null,
      currentTime: element.currentTime,
    });

    const isCurrent = () =>
      playVersion === this.#playVersion && sourceVersion === this.#sourceVersion;

    // Primer intento de reproducir: se crea la ruta de Web Audio (gesto del usuario).
    const graph = this.#ensureGraph(element);
    if (this.#routeLost) {
      // El nodo fuente se creó pero no hay ruta audible: elemento nuevo, ruta convencional.
      this.#replaceLostElement();
      return;
    }
    if (graph && !graph.running) {
      this.#resumeThenPlay(graph, element, isCurrent);
      return;
    }
    this.#requestPlay(element, isCurrent);
  }

  /**
   * Espera `resume()` y solo entonces llama a `play()`, si la intención sigue
   * vigente. Una respuesta tardía (pausa, cambio de canción, eliminación o
   * desmontaje entretanto) no reproduce nada.
   */
  #resumeThenPlay(graph: AudioOutputGraph, element: MediaElementLike, isCurrent: () => boolean): void {
    let settled = false;
    const settle = (): boolean => {
      if (settled) return false;
      settled = true;
      this.#clearResumeTimer();
      return isCurrent();
    };
    const fail = () => {
      if (settle()) this.#failOutput(OUTPUT_START_MESSAGE);
    };
    this.#resumeTimer = this.#env.setTimeout(fail, RESUME_TIMEOUT_MS);

    let request: Promise<void>;
    try {
      request = Promise.resolve(graph.context.resume());
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      () => {
        if (!settle()) return;
        if (graph.running) this.#requestPlay(element, isCurrent);
        else this.#failOutput(OUTPUT_START_MESSAGE);
      },
      fail,
    );
  }

  #requestPlay(element: MediaElementLike, isCurrent: () => boolean): void {
    let request: Promise<void>;
    try {
      request = Promise.resolve(element.play());
    } catch (error) {
      request = Promise.reject(error);
    }

    request.then(
      () => {
        if (!isCurrent()) return; // respuesta obsoleta: no toca el estado actual
        this.#cancelPendingPlay();
        if (!element.paused) this.#setState({ status: 'playing', error: null });
      },
      (error: unknown) => {
        if (!isCurrent()) return; // cancelación esperada (pausa, cambio de canción, desmontaje)
        this.#cancelPendingPlay();
        const name =
          typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
        if (name === 'AbortError') {
          this.#setState({ wantsToPlay: false, status: 'paused' });
        } else if (name === 'NotAllowedError') {
          this.#setState({
            wantsToPlay: false,
            status: 'paused',
            error: { kind: 'blocked', message: BLOCKED_MESSAGE },
          });
        } else if (name === 'NotSupportedError') {
          this.#setState({
            wantsToPlay: false,
            status: 'error',
            error: { kind: 'unsupported', message: MEDIA_ERROR_MESSAGES[4]!.message },
          });
        } else {
          this.#setState({
            wantsToPlay: false,
            status: 'error',
            error: { kind: 'play', message: 'No se pudo iniciar la reproducción.' },
          });
        }
      },
    );
  }

  #createHandlers(version: number): Record<(typeof SOURCE_EVENTS)[number], () => void> {
    // Cada handler comprueba que su fuente sigue siendo la actual.
    const guard = (fn: (element: MediaElementLike, source: LoadedSource) => void) => () => {
      const element = this.#element;
      const source = this.#source;
      if (!element || !source || source.version !== version || version !== this.#sourceVersion) return;
      fn(element, source);
    };
    const readDuration = (element: MediaElementLike) =>
      Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null;
    // Con los datos listos, una carga sin intención de reproducir queda en pausa.
    const settleLoading = (element: MediaElementLike) => {
      const becomesPaused = this.#state.status === 'loading' && !this.#state.wantsToPlay;
      this.#setState({
        duration: readDuration(element),
        ...(becomesPaused ? { status: 'paused' as const } : {}),
      });
    };

    return {
      loadedmetadata: guard(settleLoading),
      durationchange: guard((element) => this.#setState({ duration: readDuration(element) })),
      canplay: guard(settleLoading),
      timeupdate: guard((element) => this.#setState({ currentTime: element.currentTime })),
      seeked: guard((element) => this.#setState({ currentTime: element.currentTime })),
      playing: guard(() => {
        // Mientras haya un play() pendiente, quien confirma es su promesa.
        if (this.#pendingPlay !== null || !this.#state.wantsToPlay) return;
        this.#setState({ status: 'playing', error: null });
      }),
      pause: guard((element) => {
        if (element.ended || !this.#state.wantsToPlay) return;
        // Pausa externa (por ejemplo, teclas multimedia del sistema).
        this.#playVersion++;
        this.#cancelPendingPlay();
        this.#setState({ wantsToPlay: false, status: 'paused', currentTime: element.currentTime });
      }),
      waiting: guard(() => {
        if (this.#state.wantsToPlay && this.#state.status === 'playing') {
          this.#setState({ status: 'buffering' });
        }
      }),
      ended: guard((element, source) => {
        this.#playVersion++;
        this.#cancelPendingPlay();
        this.#setState({
          status: 'ended',
          wantsToPlay: false,
          currentTime: readDuration(element) ?? element.currentTime,
        });
        if (source.endedHandled) return;
        source.endedHandled = true;
        this.#onEnded?.(source.songId);
      }),
      error: guard((element) => {
        this.#playVersion++;
        this.#cancelPendingPlay();
        const info = MEDIA_ERROR_MESSAGES[element.error?.code ?? 0] ?? {
          kind: 'load' as const,
          message: 'No se pudo cargar el audio.',
        };
        this.#setState({ status: 'error', wantsToPlay: false, error: info });
      }),
      volumechange: guard((element) => {
        this.#volume = element.volume;
        this.#muted = element.muted;
        this.#setState({ volume: element.volume, muted: element.muted });
      }),
    };
  }
}
