import { DoublyLinkedList } from './DoublyLinkedList';
import type { ReadonlyNode } from './DoublyLinkedNode';
import type { Song } from './Song';

/** Dónde insertar una canción. `index` es interno (base 0). */
export type InsertPlacement =
  | { readonly kind: 'first' }
  | { readonly kind: 'last' }
  | { readonly kind: 'at'; readonly index: number };

/**
 * Copia inmutable del estado de la playlist para renderizar.
 * Solo contiene datos planos (sin nodos ni instancias de clases).
 */
export interface PlaylistSnapshot {
  /** Canciones en orden head → tail. */
  readonly songs: readonly Song[];
  /** Id de la canción seleccionada, o `null` si no hay selección. */
  readonly currentId: string | null;
  /** Índice interno (base 0) de la canción seleccionada, o -1. */
  readonly currentIndex: number;
  readonly totalDurationSeconds: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

/** Se lanza al insertar una canción cuyo id ya está en la playlist. */
export class DuplicateSongIdError extends Error {
  constructor(readonly songId: string) {
    super(`Ya existe una canción con el id "${songId}".`);
    this.name = 'DuplicateSongIdError';
  }
}

/**
 * Playlist basada en `DoublyLinkedList<Song>` con una referencia al nodo actual.
 *
 * Reglas:
 * - La primera inserción en una playlist vacía selecciona esa canción; las demás
 *   inserciones conservan la selección.
 * - Al eliminar la canción actual se selecciona la siguiente; si no existe, la
 *   anterior; si era la única, la selección queda vacía. Los vecinos se capturan
 *   antes de `remove`, porque `remove` desvincula el nodo.
 * - Eliminar otra canción conserva la selección.
 * - `next` y `previous` siguen los enlaces `next`/`prev` y no salen de los extremos.
 * - Los títulos pueden repetirse; los ids no.
 * - Una operación inválida no modifica el estado: las inserciones lanzan un error
 *   antes de mutar, y `remove`, `select`, `next` y `previous` devuelven `false`.
 */
export class Playlist {
  readonly #list = new DoublyLinkedList<Song>();
  #current: ReadonlyNode<Song> | null = null;
  /** Ids presentes, para rechazar duplicados en O(1). Refleja el contenido de la lista. */
  readonly #ids = new Set<string>();

  get size(): number {
    return this.#list.size;
  }

  /** Canción seleccionada, o `null`. */
  get current(): Song | null {
    return this.#current?.data ?? null;
  }

  /** `true` si existe una canción después de la actual. */
  get hasNext(): boolean {
    return this.#current?.next != null;
  }

  /** `true` si existe una canción antes de la actual. */
  get hasPrevious(): boolean {
    return this.#current?.prev != null;
  }

  /** `true` si la playlist contiene una canción con ese id. */
  has(id: string): boolean {
    return this.#ids.has(id);
  }

  /**
   * Inserta `song` según `placement` (por defecto, al final).
   *
   * @throws DuplicateSongIdError si el id ya existe.
   * @throws RangeError si `placement.index` no es un entero entre 0 y `size`.
   * En ambos casos la playlist no se modifica.
   */
  add(song: Song, placement: InsertPlacement = { kind: 'last' }): void {
    if (this.#ids.has(song.id)) throw new DuplicateSongIdError(song.id);

    let node: ReadonlyNode<Song>;
    switch (placement.kind) {
      case 'first':
        node = this.#list.insertFirst(song);
        break;
      case 'last':
        node = this.#list.insertLast(song);
        break;
      case 'at':
        // insertAt valida el índice antes de modificar la lista.
        node = this.#list.insertAt(placement.index, song);
        break;
    }

    this.#ids.add(song.id);
    if (this.#current === null) this.#current = node;
  }

  addFirst(song: Song): void {
    this.add(song, { kind: 'first' });
  }

  addLast(song: Song): void {
    this.add(song, { kind: 'last' });
  }

  addAt(index: number, song: Song): void {
    this.add(song, { kind: 'at', index });
  }

  /**
   * Elimina la canción con ese id.
   * @returns `true` si la eliminó; `false` (sin cambios) si no existe.
   */
  remove(id: string): boolean {
    const node = this.#nodeById(id);
    if (node === null) return false;

    if (node === this.#current) {
      // Capturar los vecinos antes de remove: después quedan en null.
      const { next, prev } = node;
      this.#list.remove(node);
      this.#current = next ?? prev;
    } else {
      this.#list.remove(node);
    }
    this.#ids.delete(id);
    return true;
  }

  /**
   * Selecciona la canción con ese id.
   * @returns `true` si existe; `false` (sin cambios) si no.
   */
  select(id: string): boolean {
    const node = this.#nodeById(id);
    if (node === null) return false;
    this.#current = node;
    return true;
  }

  /**
   * Avanza a la siguiente canción siguiendo `next`.
   * @returns `false` (sin cambios) si no hay selección o la actual es la última.
   */
  next(): boolean {
    const target = this.#current?.next ?? null;
    if (target === null) return false;
    this.#current = target;
    return true;
  }

  /**
   * Retrocede a la canción anterior siguiendo `prev`.
   * @returns `false` (sin cambios) si no hay selección o la actual es la primera.
   */
  previous(): boolean {
    const target = this.#current?.prev ?? null;
    if (target === null) return false;
    this.#current = target;
    return true;
  }

  /** Vacía la playlist y la selección. */
  clear(): void {
    this.#list.clear();
    this.#ids.clear();
    this.#current = null;
  }

  /** Canciones en orden head → tail (copia). */
  toArray(): Song[] {
    return this.#list.toArray();
  }

  /** Construye un snapshot nuevo recorriendo la lista una sola vez. */
  snapshot(): PlaylistSnapshot {
    const songs: Song[] = [];
    let currentIndex = -1;
    let totalDurationSeconds = 0;
    for (const node of this.#list.nodes()) {
      if (node === this.#current) currentIndex = songs.length;
      songs.push(node.data);
      totalDurationSeconds += node.data.durationSeconds;
    }
    return Object.freeze({
      songs: Object.freeze(songs),
      currentId: this.current?.id ?? null,
      currentIndex,
      totalDurationSeconds,
      hasPrevious: this.hasPrevious,
      hasNext: this.hasNext,
    });
  }

  #nodeById(id: string): ReadonlyNode<Song> | null {
    if (!this.#ids.has(id)) return null;
    return this.#list.find((song) => song.id === id);
  }
}
