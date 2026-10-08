/** Canción de la playlist. */
export interface Song {
  /** Identificador único. */
  readonly id: string;
  readonly title: string;
  /**
   * Artista, o `null` si no se indicó. El dominio no inventa este dato: la
   * interfaz decide cómo mostrar su ausencia ("Artista no especificado").
   */
  readonly artist: string | null;
  /**
   * Duración en segundos enteros (mayor que 0). Si la duración real tiene
   * decimales, la capa que la detecta decide cómo convertirla (la interfaz
   * redondea hacia arriba) y conserva el valor preciso por su cuenta.
   */
  readonly durationSeconds: number;
}

export interface SongInput {
  title: string;
  /** Opcional. Vacío, solo espacios, `null` o ausente equivalen a "sin artista". */
  artist?: string | null | undefined;
  durationSeconds: number;
}

/** Errores de validación por campo. Un campo ausente significa que es válido. */
export type SongValidationErrors = Partial<Record<'title' | 'durationSeconds', string>>;

/**
 * Valida los datos de una canción sin lanzar excepciones.
 *
 * - `title` no puede quedar vacío después de recortarlo.
 * - `artist` es opcional y no se valida.
 * - `durationSeconds` debe ser un entero mayor que 0.
 *
 * @returns un objeto con un mensaje por cada campo inválido (vacío si todo es válido).
 */
export function validateSongInput(input: SongInput): SongValidationErrors {
  const errors: SongValidationErrors = {};
  if (input.title.trim() === '') errors.title = 'El título no puede estar vacío.';
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    errors.durationSeconds = 'La duración debe ser un número entero de segundos mayor que 0.';
  }
  return errors;
}

/** Normaliza el artista: recorta y convierte la ausencia en `null`. */
function normalizeArtist(artist: string | null | undefined): string | null {
  const trimmed = artist?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Crea una canción validada con un id único.
 *
 * - `title` se recorta y no puede quedar vacío.
 * - `artist` se recorta; si queda vacío o no se indica, se guarda `null`.
 * - `durationSeconds` debe ser un entero mayor que 0.
 *
 * @param generateId generador de ids. Por defecto usa `crypto.randomUUID()`, que
 *   en el navegador solo existe en contextos seguros; la interfaz inyecta su
 *   propio generador con alternativa (`src/lib/idGenerator.ts`).
 * @throws Error con el mensaje del primer campo inválido (título, duración).
 */
export function createSong(
  input: SongInput,
  generateId: () => string = () => crypto.randomUUID(),
): Song {
  const errors = validateSongInput(input);
  const firstError = errors.title ?? errors.durationSeconds;
  if (firstError !== undefined) throw new Error(firstError);
  return {
    id: generateId(),
    title: input.title.trim(),
    artist: normalizeArtist(input.artist),
    durationSeconds: input.durationSeconds,
  };
}
