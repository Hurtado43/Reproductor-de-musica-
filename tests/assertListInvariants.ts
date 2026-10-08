import { expect } from 'vitest';
import type { DoublyLinkedList, ReadonlyNode } from '../src/domain';

/** Lanza un error de aserción con un mensaje descriptivo si `condition` es falsa. */
function check(condition: boolean, message: string): asserts condition {
  if (!condition) expect.fail(`Invariante rota: ${message}`);
}

/**
 * Verifica las invariantes estructurales recorriendo los enlaces reales
 * (no usa toArray) y, opcionalmente, el contenido esperado head → tail.
 *
 * Usa comparaciones directas y solo llama a `expect` cuando algo falla: este
 * verificador se ejecuta después de cada paso en secuencias largas y una
 * llamada a `expect` por enlace hacía que esas pruebas superaran el tiempo límite.
 */
export function assertListInvariants<T>(list: DoublyLinkedList<T>, expected?: readonly T[]): void {
  const { head, tail, size } = list;

  if (size === 0) {
    check(head === null, 'lista vacía con head distinto de null');
    check(tail === null, 'lista vacía con tail distinto de null');
    check(list.isEmpty, 'size es 0 pero isEmpty es false');
  } else {
    check(head !== null, `size ${size} pero head es null`);
    check(tail !== null, `size ${size} pero tail es null`);
    check(!list.isEmpty, `size ${size} pero isEmpty es true`);
    check(head.prev === null, 'head.prev no es null');
    check(tail.next === null, 'tail.next no es null');
    if (size === 1) check(head === tail, 'con un nodo, head y tail no son el mismo');
  }

  // Recorrido hacia adelante con tope para detectar ciclos.
  const forward: ReadonlyNode<T>[] = [];
  const seen = new Set<ReadonlyNode<T>>();
  let previous: ReadonlyNode<T> | null = null;
  for (let node = head; node !== null; node = node.next) {
    check(!seen.has(node), `ciclo detectado hacia adelante en la posición ${forward.length}`);
    check(forward.length < size, `hay más nodos que size (${size}) hacia adelante`);
    check(node.prev === previous, `enlace prev no recíproco en la posición ${forward.length}`);
    check(list.contains(node), `el nodo en la posición ${forward.length} no pertenece a la lista`);
    seen.add(node);
    forward.push(node);
    previous = node;
  }
  check(forward.length === size, `size es ${size} pero hay ${forward.length} nodos`);
  check(previous === tail, 'el recorrido hacia adelante no termina en tail');

  // Recorrido hacia atrás: debe visitar exactamente los mismos nodos invertidos.
  let following: ReadonlyNode<T> | null = null;
  let steps = 0;
  for (let node = tail; node !== null; node = node.prev) {
    check(steps < size, `ciclo o más nodos que size (${size}) hacia atrás`);
    check(node.next === following, `enlace next no recíproco a ${steps} pasos de tail`);
    check(node === forward[size - 1 - steps], `el recorrido hacia atrás difiere a ${steps} pasos de tail`);
    following = node;
    steps++;
  }
  check(steps === size, `hacia atrás hay ${steps} nodos pero size es ${size}`);
  check(following === head, 'el recorrido hacia atrás no termina en head');

  if (expected) expect(forward.map((n) => n.data)).toEqual(expected);
}

/** Un nodo desvinculado no tiene enlaces y no pertenece a la lista. */
export function assertDetached<T>(list: DoublyLinkedList<T>, node: ReadonlyNode<T>): void {
  expect(node.prev).toBeNull();
  expect(node.next).toBeNull();
  expect(list.contains(node)).toBe(false);
}
