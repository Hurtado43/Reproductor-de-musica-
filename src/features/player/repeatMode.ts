/**
 * Modo de repetición (fase 4B). Es una preferencia del reproductor: se guarda
 * con el volumen y el silencio, y solo decide qué ocurre cuando una canción
 * termina (`ended`). Anterior y Siguiente no lo consultan.
 */
export type RepeatMode = 'off' | 'all' | 'one';

export const REPEAT_MODES: readonly RepeatMode[] = ['off', 'all', 'one'];
export const DEFAULT_REPEAT_MODE: RepeatMode = 'off';

export function isRepeatMode(value: unknown): value is RepeatMode {
  return value === 'off' || value === 'all' || value === 'one';
}

/** Siguiente modo del botón: desactivada → playlist → canción → desactivada. */
export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return REPEAT_MODES[(REPEAT_MODES.indexOf(mode) + 1) % REPEAT_MODES.length]!;
}

export const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: 'Sin repetición',
  all: 'Repetir playlist',
  one: 'Repetir canción',
};

/** Qué hacer al terminar la canción actual. */
export type EndAction =
  /** Pasar al nodo `next` y reproducirlo. */
  | 'next'
  /** Volver al primer nodo y reproducirlo (repetir playlist desde la última). */
  | 'first'
  /** Reiniciar la actual desde 0 y reproducirla. */
  | 'replay'
  /** Quedar finalizada (sin repetición, en la última). */
  | 'stop';

/**
 * Decisión al terminar una canción.
 * - Desactivada: siguiente; en la última, finalizada.
 * - Repetir playlist: siguiente; desde la última, la primera (con una sola
 *   canción, la misma: se vuelve a reproducir).
 * - Repetir canción: la misma desde 0.
 */
export function actionAfterEnd(mode: RepeatMode, hasNext: boolean, size: number): EndAction {
  if (mode === 'one') return 'replay';
  if (hasNext) return 'next';
  if (mode === 'all') return size <= 1 ? 'replay' : 'first';
  return 'stop';
}
