/**
 * Vista de solo lectura de un nodo. Es lo que la lista entrega hacia afuera:
 * permite leer los datos y navegar por los enlaces, pero no reasignarlos.
 * Solo `DoublyLinkedList` modifica `prev` y `next`.
 */
export interface ReadonlyNode<T> {
  readonly data: T;
  readonly prev: ReadonlyNode<T> | null;
  readonly next: ReadonlyNode<T> | null;
}

/**
 * Nodo de una lista doblemente enlazada.
 *
 * - `data`: valor almacenado.
 * - `prev`: nodo anterior, o `null` si es el primero (head) o está desvinculado.
 * - `next`: nodo siguiente, o `null` si es el último (tail) o está desvinculado.
 *
 * Un nodo recién creado está desvinculado (`prev` y `next` en `null`).
 */
export class DoublyLinkedNode<T> implements ReadonlyNode<T> {
  data: T;
  prev: DoublyLinkedNode<T> | null = null;
  next: DoublyLinkedNode<T> | null = null;

  constructor(data: T) {
    this.data = data;
  }
}
