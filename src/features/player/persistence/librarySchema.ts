import { createSong, type Song } from '@/domain';
import type { AudioSource } from '../audio/sourceRegistry';
import { DEFAULT_REPEAT_MODE, isRepeatMode, type RepeatMode } from '../repeatMode';

/**
 * Esquema de la biblioteca guardada en IndexedDB (fase 4A).
 *
 * Base de datos `reproductor-musica`, versión 1:
 *   - `songs` (keyPath `id`): una entrada por canción, con sus metadatos y el
 *     archivo MP3 real (`Blob`/`File`). Metadatos y archivo van en el mismo
 *     registro: no puede quedar uno sin el otro.
 *   - `meta` (keyPath `key`): el registro `library` con el orden (lista de ids),
 *     la selección, el volumen, el silencio y (desde la 4B) el modo de
 *     repetición. Cambiar solo la selección o las
 *     preferencias reescribe este registro, nunca los MP3.
 *
 * No se guardan URLs `blob:`, nodos de la lista, elementos de audio, nodos de
 * Web Audio ni objetos de three. La lista de ids es solo el formato de
 * almacenamiento: al restaurar se reconstruye la lista doblemente enlazada.
 */

export const DB_NAME = 'reproductor-musica';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const SONGS_STORE = 'songs';
export const META_STORE = 'meta';
export const LIBRARY_KEY = 'library';
/** Prefijo de la copia del registro original que se guarda antes de reescribirlo tras una recuperación parcial. */
export const BACKUP_KEY_PREFIX = 'library-before-recovery-';

export interface StoredSongRecord {
  id: string;
  title: string;
  artist: string | null;
  /** Duración entera del dominio (redondeada hacia arriba). */
  durationSeconds: number;
  /** Duración precisa detectada por el navegador. */
  preciseDurationSeconds: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  lastModified: number;
  /** Momento de la importación (ms). Sirve de orden de reserva si falta el registro `library`. */
  createdAt: number;
  file: Blob;
}

export interface StoredLibraryRecord {
  key: typeof LIBRARY_KEY;
  schemaVersion: number;
  /** Ids en orden head → tail. */
  order: string[];
  selectedId: string | null;
  volume: number;
  muted: boolean;
  /**
   * Modo de repetición (fase 4B). Opcional y sin migración: los registros
   * anteriores no lo tienen y equivalen a `'off'`; un valor inválido, también.
   */
  repeatMode?: RepeatMode;
  /**
   * Reproducción aleatoria (fase 5). Opcional y sin migración: ausente o
   * inválido = desactivada. Solo la preferencia: el historial y los
   * candidatos se reconstruyen en cada sesión.
   */
  shuffle?: boolean;
  /** Crece en cada escritura confirmada. */
  revision: number;
  savedAt: number;
}

/** Lo leído de IndexedDB, sin validar. */
export interface RawLibraryData {
  songs: unknown[];
  library: unknown;
}

export interface RestoredEntry {
  readonly song: Song;
  readonly source: AudioSource;
}

export interface RestoredLibrary {
  /** Canciones válidas, en orden. */
  readonly entries: readonly RestoredEntry[];
  readonly selectedId: string | null;
  readonly volume: number;
  readonly muted: boolean;
  readonly repeatMode: RepeatMode;
  readonly shuffle: boolean;
  readonly revision: number;
  /** Lo que no se pudo recuperar (texto para el usuario). Vacío si todo estaba bien. */
  readonly problems: readonly string[];
  /** Registro `library` original, para guardar una copia antes de reescribirlo si hubo problemas. */
  readonly originalLibrary: unknown;
}

export type ValidationResult =
  | { readonly kind: 'ok'; readonly library: RestoredLibrary }
  | { readonly kind: 'incompatible'; readonly message: string };

export const EMPTY_LIBRARY: RestoredLibrary = Object.freeze({
  entries: Object.freeze([]),
  selectedId: null,
  volume: 1,
  muted: false,
  repeatMode: DEFAULT_REPEAT_MODE,
  shuffle: false,
  revision: 0,
  problems: Object.freeze([]),
  originalLibrary: undefined,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const label = (record: Record<string, unknown>): string =>
  typeof record.title === 'string' && record.title.trim() !== '' ? `«${record.title.trim()}»` : 'Una canción';

/** Valida un registro de canción. Devuelve la entrada o el motivo del rechazo. */
function validateSong(raw: unknown): { entry: RestoredEntry; createdAt: number } | { problem: string } {
  if (!isRecord(raw)) return { problem: 'Una entrada guardada no tiene un formato válido.' };
  const name = label(raw);
  const { id, title, artist, durationSeconds, preciseDurationSeconds, fileName, fileType, file } = raw;
  if (typeof id !== 'string' || id.trim() === '') return { problem: `${name}: identificador no válido.` };
  if (typeof Blob === 'undefined' || !(file instanceof Blob) || file.size === 0) {
    return { problem: `${name}: falta el archivo de audio o está vacío.` };
  }
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    return { problem: `${name}: falta el nombre del archivo.` };
  }
  if (typeof preciseDurationSeconds !== 'number' || !Number.isFinite(preciseDurationSeconds) || preciseDurationSeconds <= 0) {
    return { problem: `${name}: duración no válida.` };
  }
  if (typeof title !== 'string' || (artist !== null && typeof artist !== 'string')) {
    return { problem: `${name}: metadatos no válidos.` };
  }
  let song: Song;
  try {
    // El dominio valida título y duración; el id es el guardado.
    song = createSong({ title, artist, durationSeconds: durationSeconds as number }, () => id);
  } catch {
    return { problem: `${name}: metadatos no válidos.` };
  }

  const type = typeof fileType === 'string' && fileType !== '' ? fileType : file.type || 'audio/mpeg';
  const lastModified = typeof raw.lastModified === 'number' ? raw.lastModified : Date.now();
  const restoredFile =
    typeof File !== 'undefined' && file instanceof File
      ? file
      : new File([file], fileName, { type, lastModified });
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  return {
    entry: { song, source: { file: restoredFile, fileName, durationSeconds: preciseDurationSeconds } },
    createdAt,
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Valida lo leído de IndexedDB y recupera todo lo posible.
 *
 * - Versión de esquema mayor que la conocida → `incompatible` (no se toca nada).
 * - Canciones inválidas (sin archivo, vacío, metadatos o duración no válidos)
 *   no se muestran y se informan. Sus registros no se borran.
 * - Orden: ids únicos con canción válida. Si falta o está dañado el registro
 *   `library`, las canciones válidas se ordenan por fecha de importación.
 * - Selección inválida → primera canción válida, o `null` si no queda ninguna.
 * - Volumen fuera de [0, 1] → 1; silencio no booleano → `false`.
 */
export function validateStoredLibrary(raw: RawLibraryData): ValidationResult {
  const problems: string[] = [];
  const library = raw.library;

  if (isRecord(library) && typeof library.schemaVersion === 'number' && library.schemaVersion > SCHEMA_VERSION) {
    return {
      kind: 'incompatible',
      message:
        'La biblioteca guardada es de una versión más reciente de la aplicación. No se modificó; los cambios de esta sesión no se guardarán.',
    };
  }

  const valid = new Map<string, { entry: RestoredEntry; createdAt: number }>();
  for (const rawSong of raw.songs) {
    const result = validateSong(rawSong);
    if ('problem' in result) {
      problems.push(result.problem);
      continue;
    }
    if (valid.has(result.entry.song.id)) {
      problems.push(`${label(rawSong as Record<string, unknown>)}: identificador repetido.`);
      continue;
    }
    valid.set(result.entry.song.id, result);
  }

  const libraryOk =
    isRecord(library) && library.schemaVersion === SCHEMA_VERSION && Array.isArray(library.order);

  let order: string[];
  if (libraryOk) {
    order = [];
    const seen = new Set<string>();
    let missing = 0;
    for (const id of library.order as unknown[]) {
      if (typeof id !== 'string' || seen.has(id)) {
        missing++;
        continue;
      }
      seen.add(id);
      if (valid.has(id)) order.push(id);
      else if (!raw.songs.some((s) => isRecord(s) && s.id === id)) missing++;
      // Si existe un registro pero es inválido, ya se informó arriba.
    }
    if (missing > 0) {
      problems.push(
        `${missing} ${plural(missing, 'entrada del orden guardado no tenía', 'entradas del orden guardado no tenían')} canción o archivo.`,
      );
    }
    const unlisted = [...valid.keys()].filter((id) => !seen.has(id)).length;
    if (unlisted > 0) {
      problems.push(
        `${unlisted} ${plural(unlisted, 'archivo guardado no figuraba', 'archivos guardados no figuraban')} en la playlist y no se ${plural(unlisted, 'muestra', 'muestran')} (se conservan sin cambios).`,
      );
    }
  } else {
    order = [...valid.values()].sort((a, b) => a.createdAt - b.createdAt).map((v) => v.entry.song.id);
    if (library !== undefined || order.length > 0) {
      problems.push(
        order.length > 0
          ? 'No se pudo leer el orden guardado: las canciones se recuperaron en orden de importación.'
          : 'El registro de la playlist guardada estaba dañado.',
      );
    }
  }

  const entries = order.map((id) => valid.get(id)!.entry);
  const ids = new Set(order);

  let selectedId: string | null = entries[0]?.song.id ?? null;
  let volume = 1;
  let muted = false;
  let repeatMode: RepeatMode = DEFAULT_REPEAT_MODE;
  let shuffle = false;
  let revision = 0;
  if (libraryOk) {
    const storedSelected = library.selectedId;
    if (typeof storedSelected === 'string' && ids.has(storedSelected)) {
      selectedId = storedSelected;
    } else if (storedSelected !== null && entries.length > 0) {
      problems.push('La canción seleccionada no se pudo recuperar: se seleccionó la primera.');
    }
    if (typeof library.volume === 'number' && Number.isFinite(library.volume) && library.volume >= 0 && library.volume <= 1) {
      volume = library.volume;
    } else {
      problems.push('El volumen guardado no era válido: se usa 100 %.');
    }
    if (typeof library.muted === 'boolean') muted = library.muted;
    else problems.push('El estado de silencio guardado no era válido: se desactivó.');
    // Ausente (datos anteriores a la 4B) = sin repetición, sin aviso.
    if (isRepeatMode(library.repeatMode)) repeatMode = library.repeatMode;
    else if (library.repeatMode !== undefined) {
      problems.push('El modo de repetición guardado no era válido: se desactivó.');
    }
    // Ausente (datos anteriores a la fase 5) = desactivado, sin aviso.
    if (typeof library.shuffle === 'boolean') shuffle = library.shuffle;
    else if (library.shuffle !== undefined) {
      problems.push('La preferencia de reproducción aleatoria guardada no era válida: se desactivó.');
    }
    if (typeof library.revision === 'number' && Number.isFinite(library.revision)) revision = library.revision;
  }

  return {
    kind: 'ok',
    library: { entries, selectedId, volume, muted, repeatMode, shuffle, revision, problems, originalLibrary: library },
  };
}

/** Registro de canción listo para guardar (incluye el archivo real). */
export function toStoredSong(song: Song, source: AudioSource, createdAt: number): StoredSongRecord {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    durationSeconds: song.durationSeconds,
    preciseDurationSeconds: source.durationSeconds,
    fileName: source.fileName,
    fileType: source.file.type,
    fileSize: source.file.size,
    lastModified: source.file.lastModified,
    createdAt,
    file: source.file,
  };
}
