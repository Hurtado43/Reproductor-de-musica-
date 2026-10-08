import { DoublyLinkedNode, type ReadonlyNode } from './DoublyLinkedNode';

/**
 * Lista doblemente enlazada genérica.
 *
 * Invariantes que conserva toda operación pública:
 * 1. Lista vacía: `head` y `tail` son `null` y `size` es 0.
 * 2. Con un solo nodo, `head` y `tail` son el mismo nodo.
 * 3. `head.prev` es `null` y `tail.next` es `null`.
 * 4. Enlaces recíprocos: si `a.next === b` entonces `b.prev === a`.
 * 5. `size` es igual a la cantidad de nodos alcanzables desde `head`.
 * 6. No hay ciclos.
 * 7. Un nodo eliminado (o retirado con `clear`) queda con `prev` y `next` en `null`.
 * 8. Las operaciones con nodos ajenos o índices inválidos no modifican la lista.
 *
 * Los índices son internos y empiezan en 0. Todas las operaciones trabajan
 * sobre los enlaces de los nodos; `toArray` existe solo para mostrar o
 * serializar.
 */
export class DoublyLinkedList<T> {
  #head: DoublyLinkedNode<T> | null = null;
  #tail: DoublyLinkedNode<T> | null = null;
  #size = 0;
  /** Nodos que pertenecen actualmente a esta lista (verificación O(1)). */
  #owned = new WeakSet<object>();

  /** Primer nodo, o `null` si la lista está vacía. */
  get head(): ReadonlyNode<T> | null {
    return this.#head;
  }

  /** Último nodo, o `null` si la lista está vacía. */
  get tail(): ReadonlyNode<T> | null {
    return this.#tail;
  }

  /** Cantidad de nodos de la lista. */
  get size(): number {
    return this.#size;
  }

  /** `true` si la lista no tiene nodos. */
  get isEmpty(): boolean {
    return this.#size === 0;
  }

  /**
   * Inserta `data` al inicio.
   * Post: el nuevo nodo es `head`; si la lista estaba vacía, también es `tail`.
   * Complejidad O(1).
   * @returns el nodo creado.
   */
  insertFirst(data: T): ReadonlyNode<T> {
    const node = this.#adopt(data);
    if (this.#head === null) {
      this.#head = this.#tail = node;
    } else {
      node.next = this.#head;
      this.#head.prev = node;
      this.#head = node;
    }
    this.#size++;
    return node;
  }

  /**
   * Inserta `data` al final.
   * Post: el nuevo nodo es `tail`; si la lista estaba vacía, también es `head`.
   * Complejidad O(1).
   * @returns el nodo creado.
   */
  insertLast(data: T): ReadonlyNode<T> {
    const node = this.#adopt(data);
    if (this.#tail === null) {
      this.#head = this.#tail = node;
    } else {
      node.prev = this.#tail;
      this.#tail.next = node;
      this.#tail = node;
    }
    this.#size++;
    return node;
  }

  /**
   * Inserta `data` para que quede en la posición `index` (base 0).
   *
   * Pre: `index` es un entero entre 0 y `size`, ambos inclusive.
   *   - `0` equivale a `insertFirst`.
   *   - `size` equivale a `insertLast`.
   *   - Otro valor inserta antes del nodo que hoy ocupa `index`.
   * Post: el nuevo nodo ocupa `index` y los siguientes se desplazan una posición.
   * Complejidad O(min(index, size - index)): recorre desde el extremo más cercano.
   *
   * @throws RangeError si `index` es negativo, fraccionario, no finito o mayor
   *   que `size`. En ese caso la lista no se modifica.
   * @returns el nodo creado.
   */
  insertAt(index: number, data: T): ReadonlyNode<T> {
    if (!DoublyLinkedList.#isValidIndex(index, this.#size)) {
      throw new RangeError(
        `Índice de inserción inválido: ${index}. Debe ser un entero entre 0 y ${this.#size}.`,
      );
    }
    if (index === 0) return this.insertFirst(data);
    if (index === this.#size) return this.insertLast(data);

    // 0 < index < size: existe un nodo actual en `index` con un nodo anterior.
    const current = this.#nodeAt(index)!;
    const before = current.prev!;
    const node = this.#adopt(data);
    node.prev = before;
    node.next = current;
    before.next = node;
    current.prev = node;
    this.#size++;
    return node;
  }

  /**
   * Devuelve el nodo en la posición `index` (base 0), o `null` si `index` no es
   * un entero entre 0 y `size - 1`. No modifica la lista.
   * Complejidad O(min(index, size - index)).
   */
  nodeAt(index: number): ReadonlyNode<T> | null {
    if (!DoublyLinkedList.#isValidIndex(index, this.#size - 1)) return null;
    return this.#nodeAt(index);
  }

  /**
   * Busca, desde `head` hacia `tail`, el primer nodo cuyo dato cumple `predicate`.
   * `predicate` recibe el dato y su índice. No debe modificar la lista.
   * @returns el nodo encontrado, o `null` si ninguno cumple el criterio.
   */
  find(predicate: (data: T, index: number) => boolean): ReadonlyNode<T> | null {
    let index = 0;
    for (let node = this.#head; node !== null; node = node.next) {
      if (predicate(node.data, index)) return node;
      index++;
    }
    return null;
  }

  /**
   * Devuelve el índice (base 0) de `node` en esta lista, o -1 si no pertenece.
   * Complejidad O(n).
   */
  indexOf(node: ReadonlyNode<T>): number {
    if (!this.contains(node)) return -1;
    let index = 0;
    for (let current = this.#head; current !== null; current = current.next) {
      if (current === node) return index;
      index++;
    }
    return -1;
  }

  /** `true` si `node` pertenece actualmente a esta lista. Complejidad O(1). */
  contains(node: ReadonlyNode<T>): boolean {
    return this.#owned.has(node);
  }

  /**
   * Elimina `node` de la lista.
   *
   * Pre: ninguna. Si `node` no pertenece a esta lista (es de otra lista, fue
   * creado por fuera o ya se eliminó), la lista no se modifica.
   * Post (si pertenecía): sus vecinos quedan enlazados entre sí, `head`/`tail`
   * se actualizan si hacía falta, `size` disminuye en 1 y el nodo queda
   * desvinculado (`prev` y `next` en `null`).
   * Complejidad O(1).
   *
   * @returns `true` si eliminó el nodo; `false` si no pertenecía a la lista.
   */
  remove(node: ReadonlyNode<T>): boolean {
    if (!this.contains(node)) return false;
    const target = node as DoublyLinkedNode<T>;
    const { prev, next } = target;

    if (prev === null) this.#head = next;
    else prev.next = next;

    if (next === null) this.#tail = prev;
    else next.prev = prev;

    this.#release(target);
    this.#size--;
    return true;
  }

  /**
   * Vacía la lista. Cada nodo queda desvinculado y deja de pertenecer a ella.
   * Post: `head` y `tail` son `null` y `size` es 0. La lista puede reutilizarse.
   * Complejidad O(n).
   */
  clear(): void {
    let node = this.#head;
    while (node !== null) {
      const next = node.next;
      this.#release(node);
      node = next;
    }
    this.#head = this.#tail = null;
    this.#size = 0;
  }

  /**
   * Recorre los nodos desde `head` hasta `tail`.
   * Guarda el siguiente nodo antes de entregar el actual, así que se puede
   * eliminar el nodo entregado durante el recorrido.
   */
  *nodes(): Generator<ReadonlyNode<T>, void, undefined> {
    let node = this.#head;
    while (node !== null) {
      const next = node.next;
      yield node;
      node = next;
    }
  }

  /**
   * Recorre los nodos desde `tail` hasta `head`, usando los enlaces `prev`.
   * Igual que `nodes`, permite eliminar el nodo entregado.
   */
  *nodesReverse(): Generator<ReadonlyNode<T>, void, undefined> {
    let node = this.#tail;
    while (node !== null) {
      const prev = node.prev;
      yield node;
      node = prev;
    }
  }

  /** Recorre los datos desde `head` hasta `tail`. */
  *values(): Generator<T, void, undefined> {
    for (const node of this.nodes()) yield node.data;
  }

  /** Recorre los datos desde `tail` hasta `head`. */
  *valuesReverse(): Generator<T, void, undefined> {
    for (const node of this.nodesReverse()) yield node.data;
  }

  /** Permite `for (const x of list)` y `[...list]` en orden head → tail. */
  [Symbol.iterator](): Generator<T, void, undefined> {
    return this.values();
  }

  /** Copia los datos en un arreglo, head → tail. Solo para mostrar/serializar. */
  toArray(): T[] {
    return [...this.values()];
  }

  /** Copia los datos en un arreglo, tail → head. Solo para mostrar/serializar. */
  toArrayReverse(): T[] {
    return [...this.valuesReverse()];
  }

  /** Crea un nodo nuevo y lo registra como propio. */
  #adopt(data: T): DoublyLinkedNode<T> {
    const node = new DoublyLinkedNode(data);
    this.#owned.add(node);
    return node;
  }

  /** Desvincula un nodo y lo marca como ajeno. */
  #release(node: DoublyLinkedNode<T>): void {
    node.prev = null;
    node.next = null;
    this.#owned.delete(node);
  }

  /** Pre: 0 <= index < size. Recorre desde el extremo más cercano. */
  #nodeAt(index: number): DoublyLinkedNode<T> | null {
    if (index < this.#size / 2) {
      let node = this.#head;
      for (let i = 0; i < index && node !== null; i++) node = node.next;
      return node;
    }
    let node = this.#tail;
    for (let i = this.#size - 1; i > index && node !== null; i--) node = node.prev;
    return node;
  }

  static #isValidIndex(index: number, max: number): boolean {
    return Number.isInteger(index) && index >= 0 && index <= max;
  }
}
