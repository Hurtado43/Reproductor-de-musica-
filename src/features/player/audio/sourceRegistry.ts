/**
 * Archivo de audio real asociado a una canción, durante la sesión del navegador.
 * Nunca se sube a un servidor ni se guarda en `localStorage`.
 */
export interface AudioSource {
  /** El `File` elegido por el usuario. La reproducción creará su propia URL temporal. */
  readonly file: File;
  /** Nombre original del archivo (con extensión). */
  readonly fileName: string;
  /** Duración precisa detectada por el navegador, en segundos (con decimales). */
  readonly durationSeconds: number;
}

/**
 * Registro de fuentes de audio por id de canción.
 *
 * Solo asocia id → archivo. No administra el orden ni la selección: eso sigue
 * perteneciendo a `Playlist` y a sus nodos. Lo usa `PlaylistController`, que
 * mantiene ambos sincronizados.
 */
export class AudioSourceRegistry {
  readonly #sources = new Map<string, AudioSource>();

  get size(): number {
    return this.#sources.size;
  }

  has(songId: string): boolean {
    return this.#sources.has(songId);
  }

  get(songId: string): AudioSource | undefined {
    return this.#sources.get(songId);
  }

  /**
   * Registra la fuente de una canción.
   * @throws Error si ya existe una fuente para ese id (el registro no cambia).
   */
  add(songId: string, source: AudioSource): void {
    if (this.#sources.has(songId)) {
      throw new Error(`Ya existe una fuente de audio para la canción "${songId}".`);
    }
    this.#sources.set(songId, source);
  }

  /** Retira la fuente de una canción. @returns `true` si existía. */
  delete(songId: string): boolean {
    return this.#sources.delete(songId);
  }

  clear(): void {
    this.#sources.clear();
  }

  /** Ids con fuente registrada (para pruebas y comprobaciones de consistencia). */
  ids(): string[] {
    return [...this.#sources.keys()];
  }
}
