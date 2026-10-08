import type { MediaElementLike, PlaybackEnvironment } from '../../src/features/player/audio/AudioEngine';

/*
 * Elemento de audio SIMULADO para pruebas. No reproduce sonido. Imita lo que
 * importa del navegador:
 * - `play()` pone `paused = false` y devuelve una promesa que la prueba resuelve
 *   o rechaza (`resolvePlay` / `rejectPlay`).
 * - `pause()` y cambiar o quitar el `src` rechazan los `play()` pendientes con
 *   `AbortError`, como el navegador.
 * - Los eventos se emiten a mano (`emit`, `loadMeta`, `finish`).
 */

export class FakeDomException extends Error {
  constructor(name: string, message = name) {
    super(message);
    this.name = name;
  }
}

interface PendingPlay {
  resolve(): void;
  reject(error: unknown): void;
}

export class FakeMedia implements MediaElementLike {
  #src = '';
  preload = '';
  currentTime = 0;
  volume = 1;
  muted = false;
  duration = Number.NaN;
  paused = true;
  ended = false;
  error: { code: number } | null = null;

  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  readonly log: string[] = [];
  readonly listeners = new Map<string, Set<() => void>>();
  pending: PendingPlay[] = [];

  get src(): string {
    return this.#src;
  }
  set src(value: string) {
    this.#abortPending();
    this.#src = value;
    this.log.push(`src=${value}`);
    this.duration = Number.NaN;
    this.currentTime = 0;
    this.ended = false;
    this.error = null;
  }

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    this.ended = false;
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
    this.#abortPending();
  }

  load(): void {
    this.loadCalls += 1;
    this.log.push('load');
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.#abortPending();
      this.#src = '';
      this.log.push('removeAttribute(src)');
    }
  }

  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  listenerCount(type?: string): number {
    if (type) return this.listeners.get(type)?.size ?? 0;
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }

  /** Copia de los listeners actuales (para simular eventos tardíos de una fuente anterior). */
  snapshotListeners(type: string): (() => void)[] {
    return [...(this.listeners.get(type) ?? [])];
  }

  /** El navegador leyó los metadatos y puede reproducir. */
  loadMeta(duration: number): void {
    this.duration = duration;
    this.emit('loadedmetadata');
    this.emit('durationchange');
    this.emit('canplay');
  }

  /** Confirma el `play()` pendiente más antiguo. */
  resolvePlay(index = 0): void {
    const pending = this.pending.splice(index, 1)[0];
    pending?.resolve();
    this.emit('playing');
  }

  /** Rechaza el `play()` pendiente más antiguo (por ejemplo, `NotAllowedError`). */
  rejectPlay(name: string, index = 0): void {
    const pending = this.pending.splice(index, 1)[0];
    this.paused = true;
    pending?.reject(new FakeDomException(name));
  }

  /** Avanza el tiempo como lo haría la reproducción real y emite `timeupdate`. */
  advance(seconds: number): void {
    this.currentTime = Math.min(this.currentTime + seconds, this.duration);
    this.emit('timeupdate');
  }

  /** Fin de la canción: `pause` y luego `ended`, como el navegador. */
  finish(): void {
    this.currentTime = this.duration;
    this.paused = true;
    this.ended = true;
    this.emit('timeupdate');
    this.emit('pause');
    this.emit('ended');
  }

  #abortPending(): void {
    const pending = this.pending;
    this.pending = [];
    for (const p of pending) p.reject(new FakeDomException('AbortError'));
  }
}

/**
 * Entorno simulado: registra elementos creados y URLs creadas o revocadas.
 * Por defecto NO hay Web Audio (`createAudioContext` devuelve `null`): el motor
 * usa la ruta convencional del elemento. Las pruebas de la fase 3B pasan
 * `createAudioContext` con un `FakeAudioContext` (tests/fakes/fakeAudioContext.ts).
 */
export function fakePlaybackEnvironment(overrides: Partial<PlaybackEnvironment> = {}) {
  const elements: FakeMedia[] = [];
  const created: string[] = [];
  const revoked: string[] = [];
  const order: string[] = [];
  const env: PlaybackEnvironment = {
    createAudioContext: () => null,
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    createElement: () => {
      const element = new FakeMedia();
      elements.push(element);
      return element;
    },
    createObjectURL: (file) => {
      const url = `blob:fake/${(file as File).name ?? 'archivo'}#${created.length + 1}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url) => {
      revoked.push(url);
      const element = elements[elements.length - 1];
      order.push(`revoke ${url} (src del elemento: "${element?.src ?? ''}")`);
    },
    ...overrides,
  };
  return { env, elements, created, revoked, order, media: () => elements[elements.length - 1]! };
}

/** Deja que se resuelvan las promesas pendientes. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
