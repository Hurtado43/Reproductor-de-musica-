import { describe, expect, it } from 'vitest';
import { DoublyLinkedList, DoublyLinkedNode } from '../src/domain';
import { assertDetached, assertListInvariants } from './assertListInvariants';

function listOf<T>(...items: T[]): DoublyLinkedList<T> {
  const list = new DoublyLinkedList<T>();
  for (const item of items) list.insertLast(item);
  return list;
}

describe('lista vacía y de un solo nodo', () => {
  it('una lista nueva está vacía', () => {
    const list = new DoublyLinkedList<number>();
    assertListInvariants(list, []);
    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
    expect(list.toArrayReverse()).toEqual([]);
    expect(list.find(() => true)).toBeNull();
    expect(list.nodeAt(0)).toBeNull();
  });

  it.each([
    ['insertFirst', (l: DoublyLinkedList<string>) => l.insertFirst('a')],
    ['insertLast', (l: DoublyLinkedList<string>) => l.insertLast('a')],
    ['insertAt(0)', (l: DoublyLinkedList<string>) => l.insertAt(0, 'a')],
  ])('con un nodo (%s), head y tail son el mismo', (_name, insert) => {
    const list = new DoublyLinkedList<string>();
    const node = insert(list);
    assertListInvariants(list, ['a']);
    expect(list.head).toBe(node);
    expect(list.tail).toBe(node);
    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
  });
});

describe('inserción', () => {
  it('insertFirst agrega al inicio', () => {
    const list = new DoublyLinkedList<number>();
    list.insertFirst(3);
    assertListInvariants(list, [3]);
    list.insertFirst(2);
    assertListInvariants(list, [2, 3]);
    const node = list.insertFirst(1);
    assertListInvariants(list, [1, 2, 3]);
    expect(list.head).toBe(node);
    expect(list.tail!.data).toBe(3);
  });

  it('insertLast agrega al final', () => {
    const list = new DoublyLinkedList<number>();
    list.insertLast(1);
    list.insertLast(2);
    const node = list.insertLast(3);
    assertListInvariants(list, [1, 2, 3]);
    expect(list.tail).toBe(node);
    expect(list.head!.data).toBe(1);
  });

  it('insertAt agrega en medio y desplaza los siguientes', () => {
    const list = listOf('a', 'b', 'd', 'e');
    const c = list.insertAt(2, 'c');
    assertListInvariants(list, ['a', 'b', 'c', 'd', 'e']);
    expect(c.prev!.data).toBe('b');
    expect(c.next!.data).toBe('d');
    expect(list.indexOf(c)).toBe(2);
  });

  it('insertAt en la segunda mitad (recorrido desde tail)', () => {
    const list = listOf(0, 1, 2, 3, 4, 5, 6, 7);
    list.insertAt(6, 99);
    assertListInvariants(list, [0, 1, 2, 3, 4, 5, 99, 6, 7]);
    list.insertAt(1, 98);
    assertListInvariants(list, [0, 98, 1, 2, 3, 4, 5, 99, 6, 7]);
  });

  it('insertAt(0) y insertAt(size) equivalen a inicio y final', () => {
    const list = listOf('b');
    const first = list.insertAt(0, 'a');
    const last = list.insertAt(list.size, 'c');
    assertListInvariants(list, ['a', 'b', 'c']);
    expect(list.head).toBe(first);
    expect(list.tail).toBe(last);
  });

  it('insertAt en cada posición válida produce el orden esperado', () => {
    for (let n = 0; n <= 5; n++) {
      for (let i = 0; i <= n; i++) {
        const base = Array.from({ length: n }, (_, k) => k);
        const list = listOf(...base);
        list.insertAt(i, -1);
        const expected = [...base];
        expected.splice(i, 0, -1);
        assertListInvariants(list, expected);
      }
    }
  });

  it.each([-1, 4, 100, 1.5, -0.5, Number.NaN, Infinity, -Infinity])(
    'insertAt(%s) se rechaza sin modificar la lista',
    (index) => {
      const list = listOf('a', 'b', 'c');
      const { head, tail } = list;
      expect(() => list.insertAt(index, 'x')).toThrow(RangeError);
      assertListInvariants(list, ['a', 'b', 'c']);
      expect(list.head).toBe(head);
      expect(list.tail).toBe(tail);
    },
  );

  it('insertAt(1) en lista vacía se rechaza', () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.insertAt(1, 1)).toThrow(RangeError);
    assertListInvariants(list, []);
  });
});

describe('búsqueda', () => {
  it('find devuelve el primer nodo que cumple el criterio', () => {
    const list = listOf(
      { id: 1, g: 'rock' },
      { id: 2, g: 'pop' },
      { id: 3, g: 'pop' },
    );
    expect(list.find((s) => s.g === 'pop')!.data.id).toBe(2);
    expect(list.find((_s, i) => i === 2)!.data.id).toBe(3);
    expect(list.find((s) => s.g === 'jazz')).toBeNull();
  });

  it('nodeAt devuelve el nodo por índice o null si es inválido', () => {
    const list = listOf('a', 'b', 'c', 'd', 'e');
    expect(['a', 'b', 'c', 'd', 'e'].map((_, i) => list.nodeAt(i)!.data)).toEqual([
      'a', 'b', 'c', 'd', 'e',
    ]);
    expect(list.nodeAt(0)).toBe(list.head);
    expect(list.nodeAt(4)).toBe(list.tail);
    for (const bad of [-1, 5, 1.5, Number.NaN]) expect(list.nodeAt(bad)).toBeNull();
  });

  it('indexOf devuelve -1 para nodos ajenos', () => {
    const list = listOf(1, 2);
    const other = listOf(1, 2);
    expect(list.indexOf(other.head!)).toBe(-1);
    expect(list.indexOf(list.tail!)).toBe(1);
  });
});

describe('eliminación', () => {
  it('elimina el primer nodo', () => {
    const list = listOf('a', 'b', 'c');
    const a = list.head!;
    expect(list.remove(a)).toBe(true);
    assertListInvariants(list, ['b', 'c']);
    assertDetached(list, a);
  });

  it('elimina el último nodo', () => {
    const list = listOf('a', 'b', 'c');
    const c = list.tail!;
    expect(list.remove(c)).toBe(true);
    assertListInvariants(list, ['a', 'b']);
    assertDetached(list, c);
  });

  it('elimina un nodo intermedio y une a sus vecinos', () => {
    const list = listOf('a', 'b', 'c');
    const b = list.nodeAt(1)!;
    expect(list.remove(b)).toBe(true);
    assertListInvariants(list, ['a', 'c']);
    assertDetached(list, b);
    expect(list.head!.next).toBe(list.tail);
    expect(list.tail!.prev).toBe(list.head);
  });

  it('elimina el único nodo y deja la lista vacía', () => {
    const list = listOf('a');
    const a = list.head!;
    expect(list.remove(a)).toBe(true);
    assertListInvariants(list, []);
    assertDetached(list, a);
  });

  it('no modifica la lista al eliminar un nodo de otra lista', () => {
    const list = listOf('a', 'b', 'c');
    const other = listOf('a', 'b', 'c');
    const foreign = other.nodeAt(1)!;
    expect(list.remove(foreign)).toBe(false);
    assertListInvariants(list, ['a', 'b', 'c']);
    assertListInvariants(other, ['a', 'b', 'c']);
    expect(foreign.prev).toBe(other.head);
  });

  it('no modifica la lista al eliminar un nodo creado por fuera', () => {
    const list = listOf(1, 2);
    const loose = new DoublyLinkedNode(1);
    expect(list.remove(loose)).toBe(false);
    assertListInvariants(list, [1, 2]);
  });

  it('no modifica la lista al eliminar un nodo falsificado con enlaces reales', () => {
    const list = listOf(1, 2, 3);
    const fake = { data: 2, prev: list.head, next: list.tail };
    expect(list.remove(fake)).toBe(false);
    assertListInvariants(list, [1, 2, 3]);
  });

  it('no modifica la lista al eliminar un nodo ya eliminado', () => {
    const list = listOf('a', 'b', 'c');
    const b = list.nodeAt(1)!;
    list.remove(b);
    expect(list.remove(b)).toBe(false);
    assertListInvariants(list, ['a', 'c']);
  });

  it('un nodo eliminado no puede volver a eliminarse aunque su valor se reinserte', () => {
    const list = listOf('a');
    const old = list.head!;
    list.remove(old);
    const fresh = list.insertLast('a');
    expect(list.remove(old)).toBe(false);
    assertListInvariants(list, ['a']);
    expect(list.head).toBe(fresh);
  });
});

describe('recorrido', () => {
  it('recorre head → tail y tail → head', () => {
    const list = listOf(1, 2, 3, 4);
    expect([...list.values()]).toEqual([1, 2, 3, 4]);
    expect([...list.valuesReverse()]).toEqual([4, 3, 2, 1]);
    expect([...list]).toEqual([1, 2, 3, 4]);
    expect(list.toArray()).toEqual([1, 2, 3, 4]);
    expect(list.toArrayReverse()).toEqual([4, 3, 2, 1]);
    expect([...list.nodes()].map((n) => n.data)).toEqual([1, 2, 3, 4]);
    expect([...list.nodesReverse()].map((n) => n.data)).toEqual([4, 3, 2, 1]);
  });

  it('permite eliminar el nodo actual durante el recorrido', () => {
    const list = listOf(1, 2, 3, 4, 5, 6);
    for (const node of list.nodes()) if (node.data % 2 === 0) list.remove(node);
    assertListInvariants(list, [1, 3, 5]);
    for (const node of list.nodesReverse()) if (node.data !== 3) list.remove(node);
    assertListInvariants(list, [3]);
  });
});

describe('secuencias combinadas', () => {
  it('mezcla inserciones y eliminaciones', () => {
    const list = new DoublyLinkedList<string>();
    list.insertLast('b');
    list.insertFirst('a');
    list.insertLast('d');
    list.insertAt(2, 'c');
    assertListInvariants(list, ['a', 'b', 'c', 'd']);
    list.remove(list.head!);
    assertListInvariants(list, ['b', 'c', 'd']);
    list.insertAt(3, 'e');
    list.remove(list.find((x) => x === 'c')!);
    assertListInvariants(list, ['b', 'd', 'e']);
    list.remove(list.tail!);
    list.remove(list.tail!);
    list.remove(list.tail!);
    assertListInvariants(list, []);
    list.insertAt(0, 'z');
    assertListInvariants(list, ['z']);
  });

  it('coincide con un modelo de arreglo en una secuencia pseudoaleatoria', () => {
    // Generador determinista (LCG) para reproducir la secuencia.
    let seed = 12345;
    const rand = (max: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % max;
    };
    const list = new DoublyLinkedList<number>();
    const model: number[] = [];
    for (let step = 0; step < 500; step++) {
      const op = rand(4);
      if (op === 0) {
        list.insertFirst(step);
        model.unshift(step);
      } else if (op === 1) {
        list.insertLast(step);
        model.push(step);
      } else if (op === 2) {
        const i = rand(model.length + 1);
        list.insertAt(i, step);
        model.splice(i, 0, step);
      } else if (model.length > 0) {
        const i = rand(model.length);
        const node = list.nodeAt(i)!;
        expect(list.remove(node)).toBe(true);
        assertDetached(list, node);
        model.splice(i, 1);
      }
      assertListInvariants(list, model);
    }
  });
});

describe('vaciar', () => {
  it('clear deja la lista vacía y desvincula todos los nodos', () => {
    const list = listOf(1, 2, 3);
    const nodes = [...list.nodes()];
    list.clear();
    assertListInvariants(list, []);
    for (const node of nodes) assertDetached(list, node);
    expect(list.remove(nodes[1]!)).toBe(false);
  });

  it('clear en lista vacía no falla', () => {
    const list = new DoublyLinkedList<number>();
    list.clear();
    assertListInvariants(list, []);
  });

  it('la lista se puede reutilizar después de clear', () => {
    const list = listOf('a', 'b');
    list.clear();
    list.insertLast('x');
    list.insertFirst('w');
    list.insertAt(1, 'y');
    assertListInvariants(list, ['w', 'y', 'x']);
    list.remove(list.nodeAt(1)!);
    assertListInvariants(list, ['w', 'x']);
  });
});
