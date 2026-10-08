import {
  createSong,
  DuplicateSongIdError,
  Playlist,
  type InsertPlacement,
  type PlaylistSnapshot,
  type Song,
  type SongInput,
} from '@/domain';
import { AudioSourceRegistry, type AudioSource } from './audio/sourceRegistry';

export interface ImportSongRequest {
  /** Datos para el dominio (duración en segundos enteros). */
  readonly input: SongInput;
  readonly placement: InsertPlacement;
  /** Archivo real y duración precisa. */
  readonly source: AudioSource;
}

/**
 * Coordina la `Playlist` del dominio y el registro de archivos de audio.
 *
 * - El orden y la selección pertenecen solo a `Playlist` (lista doblemente enlazada).
 * - El registro solo guarda id → archivo.
 * - Importar es atómico: o quedan la canción y su fuente, o no queda ninguna.
 * - Eliminar una canción retira también su fuente.
 *
 * Es TypeScript sin React; `usePlaylist` crea una instancia por montaje.
 */
export class PlaylistController {
  readonly #playlist = new Playlist();
  readonly #sources = new AudioSourceRegistry();
  readonly #generateId: () => string;

  constructor(generateId: () => string) {
    this.#generateId = generateId;
  }

  get size(): number {
    return this.#playlist.size;
  }

  /**
   * Crea la canción y la inserta junto con su archivo.
   *
   * Orden: crear y validar la canción → comprobar que el id no exista en
   * ninguno de los dos lados → insertar en la playlist (puede lanzar si la
   * posición no es válida, sin modificarla) → registrar la fuente (ya no puede
   * fallar). Si algo lanza, no queda ni un nodo sin archivo ni una fuente huérfana.
   *
   * @throws Error de validación, `RangeError` o `DuplicateSongIdError`.
   */
  importSong(request: ImportSongRequest): Song {
    const song = createSong(request.input, this.#generateId);
    if (this.#playlist.has(song.id) || this.#sources.has(song.id)) {
      throw new DuplicateSongIdError(song.id);
    }
    this.#playlist.add(song, request.placement);
    this.#sources.add(song.id, request.source);
    return song;
  }

  /**
   * Reconstruye la playlist y el registro a partir de canciones restauradas
   * (fase 4A), con las APIs públicas de `Playlist`: cada canción se inserta al
   * final, en orden, y después se selecciona `selectedId` (si no existe, queda la
   * primera, como al insertar en una playlist vacía).
   *
   * @throws Error si la playlist no está vacía (no se mezcla con una sesión en
   *   curso) o si hay ids repetidos; se comprueba antes de modificar nada.
   */
  restore(
    entries: readonly { readonly song: Song; readonly source: AudioSource }[],
    selectedId: string | null,
  ): void {
    if (this.#playlist.size > 0 || this.#sources.size > 0) {
      throw new Error('La biblioteca solo se restaura sobre una playlist vacía.');
    }
    const ids = new Set(entries.map((e) => e.song.id));
    if (ids.size !== entries.length) throw new Error('La biblioteca restaurada tiene ids repetidos.');
    for (const { song, source } of entries) {
      this.#playlist.add(song, { kind: 'last' });
      this.#sources.add(song.id, source);
    }
    if (selectedId !== null) this.#playlist.select(selectedId);
  }

  /**
   * Vacía la playlist (fase 4B): quita todas las canciones, la selección y las
   * fuentes del registro. Los archivos originales del dispositivo no se tocan.
   * @returns `false` si ya estaba vacía.
   */
  clear(): boolean {
    if (this.#playlist.size === 0 && this.#sources.size === 0) return false;
    this.#playlist.clear();
    this.#sources.clear();
    return true;
  }

  /** Elimina la canción y su fuente. @returns `false` (sin cambios) si no existe. */
  removeSong(id: string): boolean {
    if (!this.#playlist.remove(id)) return false;
    this.#sources.delete(id);
    return true;
  }

  /** Id de la canción seleccionada en `Playlist` (fuente única de la selección), o `null`. */
  get currentId(): string | null {
    return this.#playlist.current?.id ?? null;
  }

  selectSong(id: string): boolean {
    return this.#playlist.select(id);
  }

  next(): boolean {
    return this.#playlist.next();
  }

  previous(): boolean {
    return this.#playlist.previous();
  }

  /** Archivo y duración precisa de una canción (para la reproducción futura). */
  getSource(id: string): AudioSource | undefined {
    return this.#sources.get(id);
  }

  snapshot(): PlaylistSnapshot {
    return this.#playlist.snapshot();
  }

  /** Ids con fuente registrada (para comprobar que no hay huérfanas). */
  sourceIds(): string[] {
    return this.#sources.ids();
  }
}
