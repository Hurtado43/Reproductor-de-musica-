import { validateSongInput, type InsertPlacement } from '@/domain';
import type { AudioFileState } from './audio/useAudioFileReader';
import type { ImportSongRequest } from './playlistController';

/**
 * Conversión entre la posición visible (desde 1) y el índice interno (desde 0).
 * Es el único lugar de la interfaz donde se hace esta conversión.
 */
export function toInternalIndex(visiblePosition: number): number {
  return visiblePosition - 1;
}

export function toVisiblePosition(internalIndex: number): number {
  return internalIndex + 1;
}

/**
 * Convierte la duración precisa detectada (segundos con decimales) a los
 * segundos enteros que exige `Song`. Redondea **hacia arriba**: así una
 * duración real de 0,4 s queda en 1 s (mayor que 0) y la duración mostrada nunca
 * es menor que la real. El valor preciso se conserva en el registro de fuentes.
 */
export function toDomainDurationSeconds(preciseSeconds: number): number {
  return Math.ceil(preciseSeconds);
}

/** Título inicial: nombre del archivo sin la extensión `.mp3`, recortado. */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.mp3$/i, '').trim();
}

export type PlacementChoice = 'first' | 'last' | 'at';

/** Campos de texto del formulario, tal como los escribe el usuario. */
export interface SongFormValues {
  title: string;
  /** Opcional: vacío significa "artista no especificado". */
  artist: string;
  placement: PlacementChoice;
  /** Posición visible (desde 1); solo se usa si `placement` es `'at'`. */
  position: string;
}

export type SongFormField = 'file' | 'title' | 'position';
export type SongFormErrors = Partial<Record<SongFormField, string>>;

export const EMPTY_SONG_FORM: SongFormValues = {
  title: '',
  artist: '',
  placement: 'last',
  position: '',
};

/** Orden en que se enfoca el primer campo con error. */
export const SONG_FORM_FIELD_ORDER: readonly SongFormField[] = ['file', 'title', 'position'];

export type SongFormResult =
  | { readonly ok: true; readonly request: ImportSongRequest }
  | { readonly ok: false; readonly errors: SongFormErrors };

function fileError(file: AudioFileState): string | null {
  switch (file.status) {
    case 'empty':
      return 'Selecciona un archivo MP3.';
    case 'reading':
      return 'Espera a que termine la lectura del archivo.';
    case 'error':
      return file.message;
    case 'ready':
      return null;
  }
}

/** Convierte un texto en entero no negativo; `null` si no son solo dígitos. */
function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * Valida el formulario de importación para una playlist de `size` canciones.
 *
 * - Archivo: debe estar leído y ser válido (`status: 'ready'`).
 * - Título: se valida con `validateSongInput` del dominio.
 * - Artista: opcional.
 * - Posición específica: entero entre 1 y `size + 1`.
 *
 * La duración no se escribe: sale del archivo (ver `toDomainDurationSeconds`).
 * No modifica `values` ni el archivo: si hay errores, el formulario los conserva.
 */
export function parseSongForm(
  values: SongFormValues,
  size: number,
  file: AudioFileState,
): SongFormResult {
  const errors: SongFormErrors = {};

  const fileProblem = fileError(file);
  if (fileProblem !== null) errors.file = fileProblem;

  const titleError = validateSongInput({
    title: values.title,
    durationSeconds: 1,
  }).title;
  if (titleError) errors.title = titleError;

  let placement: InsertPlacement = { kind: 'last' };
  if (values.placement === 'first') {
    placement = { kind: 'first' };
  } else if (values.placement === 'at') {
    const position = parseWholeNumber(values.position);
    const max = size + 1;
    if (position === null || position < 1 || position > max) {
      errors.position = `Escribe una posición entera entre 1 y ${max}.`;
    } else {
      placement = { kind: 'at', index: toInternalIndex(position) };
    }
  }

  if (Object.keys(errors).length > 0 || file.status !== 'ready') return { ok: false, errors };
  return {
    ok: true,
    request: {
      input: {
        title: values.title,
        artist: values.artist,
        durationSeconds: toDomainDurationSeconds(file.durationSeconds),
      },
      placement,
      source: { file: file.file, fileName: file.file.name, durationSeconds: file.durationSeconds },
    },
  };
}

/** Posición visible en la que quedará la canción (para mensajes). */
export function resultingVisiblePosition(placement: InsertPlacement, sizeBefore: number): number {
  switch (placement.kind) {
    case 'first':
      return 1;
    case 'last':
      return sizeBefore + 1;
    case 'at':
      return toVisiblePosition(placement.index);
  }
}
