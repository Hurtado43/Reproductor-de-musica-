import { isDeclaredMp3, looksLikeMp3, MP3_SNIFF_BYTES } from './mp3Signature';

/** Tiempo máximo para que el navegador cargue los metadatos de audio. */
export const DEFAULT_METADATA_TIMEOUT_MS = 10_000;

export interface AudioMetadata {
  /** Duración precisa en segundos (finita y mayor que 0). */
  readonly durationSeconds: number;
}

export type AudioImportErrorCode =
  | 'empty'
  | 'not-mp3'
  | 'read-error'
  | 'unsupported'
  | 'invalid-duration'
  | 'timeout'
  | 'aborted';

/** Error de importación con un código estable y un mensaje para la interfaz. */
export class AudioImportError extends Error {
  constructor(
    readonly code: AudioImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AudioImportError';
  }
}

const MESSAGES: Record<AudioImportErrorCode, string> = {
  empty: 'El archivo está vacío.',
  'not-mp3': 'El archivo no es un MP3 válido.',
  'read-error': 'No se pudo leer el archivo. Vuelve a seleccionarlo.',
  unsupported: 'El navegador no pudo leer el audio de este archivo. Puede estar dañado o no ser un MP3.',
  'invalid-duration': 'No se pudo determinar una duración válida para este archivo.',
  timeout: 'La lectura del archivo tardó demasiado. Inténtalo de nuevo.',
  aborted: 'La lectura del archivo se canceló.',
};

const fail = (code: AudioImportErrorCode) => new AudioImportError(code, MESSAGES[code]);

/** Lo mínimo de `HTMLAudioElement` que se usa (permite simularlo en pruebas). */
export interface AudioElementLike {
  preload: string;
  muted: boolean;
  src: string;
  currentTime: number;
  readonly duration: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  removeAttribute(name: string): void;
  load(): void;
}

/** Dependencias del navegador, inyectables en pruebas. */
export interface MetadataEnvironment {
  createAudio(): AudioElementLike;
  createObjectURL(file: Blob): string;
  revokeObjectURL(url: string): void;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

function browserEnvironment(): MetadataEnvironment {
  return {
    createAudio: () => document.createElement('audio'),
    createObjectURL: (file) => URL.createObjectURL(file),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}

export interface ReadAudioMetadataOptions {
  /** Cancela la lectura: libera los recursos y rechaza con el código `aborted`. */
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  environment?: Partial<MetadataEnvironment> | undefined;
}

export type ReadAudioMetadata = (
  file: File,
  options?: ReadAudioMetadataOptions,
) => Promise<AudioMetadata>;

/**
 * Valida un archivo MP3 y obtiene su duración real con el navegador.
 *
 * 1. Rechaza archivos vacíos.
 * 2. Exige extensión `.mp3` o tipo `audio/mpeg` (un `type` vacío se acepta si
 *    la extensión es `.mp3`).
 * 3. Lee los primeros bytes y exige una firma MP3 (ID3 o trama Layer III).
 * 4. Carga los metadatos con un elemento de audio silenciado, `preload="metadata"`
 *    y una URL temporal. Nunca llama a `play()`.
 * 5. Exige una duración finita y mayor que 0. Si el navegador informa `Infinity`
 *    (algunos MP3 sin cabecera de duración), mueve `currentTime` al final para
 *    forzar el cálculo y espera `durationchange`.
 *
 * Al terminar, fallar, agotar el tiempo o cancelarse, quita los listeners,
 * cancela el temporizador, vacía el `src` del elemento y revoca la URL. El
 * `File` no se modifica: la reproducción futura creará su propia URL.
 *
 * @throws AudioImportError con el código correspondiente.
 */
export const readAudioMetadata: ReadAudioMetadata = async (file, options = {}) => {
  const { signal, timeoutMs = DEFAULT_METADATA_TIMEOUT_MS } = options;
  const env: MetadataEnvironment = { ...browserEnvironment(), ...options.environment };

  if (signal?.aborted) throw fail('aborted');
  if (file.size === 0) throw fail('empty');
  if (!isDeclaredMp3(file)) throw fail('not-mp3');

  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, MP3_SNIFF_BYTES).arrayBuffer());
  } catch {
    throw fail('read-error');
  }
  if (signal?.aborted) throw fail('aborted');
  if (!looksLikeMp3(head)) throw fail('not-mp3');

  const durationSeconds = await loadDuration(file, env, timeoutMs, signal);
  return { durationSeconds };
};

function loadDuration(
  file: File,
  env: MetadataEnvironment,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = env.createAudio();
    let url: string | null = null;
    let settled = false;
    let forcingDuration = false;

    const isValid = (d: number) => Number.isFinite(d) && d > 0;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      if (isValid(d)) return finish(() => resolve(d));
      if (d === Infinity && !forcingDuration) {
        forcingDuration = true;
        audio.currentTime = Number.MAX_SAFE_INTEGER;
        return;
      }
      finish(() => reject(fail('invalid-duration')));
    };
    const onDurationChange = () => {
      if (forcingDuration && isValid(audio.duration)) {
        const d = audio.duration;
        finish(() => resolve(d));
      }
    };
    const onError = () => finish(() => reject(fail('unsupported')));
    const onAbort = () => finish(() => reject(fail('aborted')));

    const timer = env.setTimeout(() => finish(() => reject(fail('timeout'))), timeoutMs);

    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      env.clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      // Soltar el archivo: vaciar src y revocar la URL temporal.
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {
        // Algunos entornos no implementan load(); no impide la limpieza.
      }
      if (url !== null) env.revokeObjectURL(url);
      url = null;
      settle();
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort);

    audio.preload = 'metadata';
    audio.muted = true;
    try {
      url = env.createObjectURL(file);
      audio.src = url;
    } catch {
      finish(() => reject(fail('read-error')));
    }
  });
}
