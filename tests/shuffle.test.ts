import { describe, expect, it } from 'vitest';
import { ShuffleNavigator } from '../src/features/player/shuffle';

/*
 * Aleatorio (fase 5): lógica pura con un generador inyectado (determinista).
 * Solo maneja ids; la selección real la hace `Playlist` en el reproductor.
 */

/** Generador que devuelve los valores dados en orden (y luego 0). */
const sequence = (...values: number[]) => () => values.shift() ?? 0;
const IDS = ['a', 'b', 'c', 'd', 'e'];

function drain(nav: ShuffleNavigator): string[] {
  const out: string[] = [];
  for (let id = nav.next(); id !== null; id = nav.next()) out.push(id);
  return out;
}

describe('ShuffleNavigator', () => {
  it('recorre todas las canciones sin repetir dentro del ciclo y nunca elige la actual', () => {
    for (let seed = 0; seed < 50; seed++) {
      let x = seed + 1;
      const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
      const nav = new ShuffleNavigator(rng);
      nav.start('c', IDS);
      const played = drain(nav);
      expect(played).not.toContain('c');
      expect(new Set(played).size).toBe(played.length);
      expect([...played].sort()).toEqual(['a', 'b', 'd', 'e']);
      expect(nav.hasNext).toBe(false);
    }
  });

  it('elección uniforme por índice del generador entre los candidatos', () => {
    // Candidatos [a, b, d, e] (sin la actual c): 0,99 → último; 0 → primero.
    const nav = new ShuffleNavigator(sequence(0.99, 0, 0.5));
    nav.start('c', IDS);
    expect(nav.next()).toBe('e');
    expect(nav.next()).toBe('a');
    expect(nav.next()).toBe('d'); // [b, d] con 0,5 → índice 1
    // Cada índice tiene la misma probabilidad: floor(r · n).
    const counts = new Map<string, number>();
    for (let i = 0; i < 4; i++) {
      const n = new ShuffleNavigator(() => (i + 0.5) / 4);
      n.start('c', IDS);
      const id = n.next()!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([1, 1, 1, 1]);
  });

  it('Anterior vuelve por el historial; después, Siguiente recorre el historial adelantado', () => {
    const nav = new ShuffleNavigator(sequence(0.99, 0.99, 0.99));
    nav.start('a', IDS);
    expect(nav.hasPrevious).toBe(false); // sin historial anterior
    const first = nav.next(); // e
    const second = nav.next(); // d
    expect(nav.previous()).toBe(first);
    expect(nav.previous()).toBe('a');
    expect(nav.previous()).toBeNull();
    expect(nav.next()).toBe(first); // adelantado, sin consumir candidatos
    expect(nav.next()).toBe(second);
    expect(nav.state.pending.sort()).toEqual(['b', 'c']);
  });

  it('agotados los candidatos, Siguiente no renueva el ciclo por su cuenta', () => {
    const nav = new ShuffleNavigator(sequence());
    nav.start('a', ['a', 'b']);
    expect(nav.next()).toBe('b');
    expect(nav.hasNext).toBe(false);
    expect(nav.next()).toBeNull();
  });

  it('nuevo ciclo: todas vuelven a ser candidatas y la primera no repite la última', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const nav = new ShuffleNavigator(() => r);
      nav.start('a', ['a', 'b', 'c']);
      drain(nav);
      const last = nav.state.history[nav.state.cursor]!;
      nav.newCycle(['a', 'b', 'c'], last);
      const firstOfCycle = nav.next();
      expect(firstOfCycle).not.toBe(last);
      const rest = drain(nav);
      expect([firstOfCycle, ...rest].sort()).toEqual(['a', 'b', 'c']);
    }
  });

  it('una sola canción: sin candidatos; un nuevo ciclo solo puede devolver la misma', () => {
    const nav = new ShuffleNavigator(sequence());
    nav.start('a', ['a']);
    expect(nav.hasNext).toBe(false);
    expect(nav.next()).toBeNull();
    nav.newCycle(['a'], 'a');
    expect(nav.next()).toBe('a'); // el reproductor la repite, no inventa otra
  });

  it('selección manual: entra al historial, descarta el adelantado y sale de los candidatos', () => {
    const nav = new ShuffleNavigator(sequence(0.99, 0.99));
    nav.start('a', IDS);
    nav.next(); // e
    nav.previous(); // a
    nav.select('c');
    expect(nav.state.history).toEqual(['a', 'c']);
    expect(nav.state.pending.sort()).toEqual(['b', 'd']);
    expect(nav.previous()).toBe('a');
  });

  it('importar añade un candidato; eliminar lo quita del historial y de los candidatos', () => {
    const nav = new ShuffleNavigator(sequence(0.99));
    nav.start('a', ['a', 'b']);
    nav.add('z');
    expect(nav.state.pending.sort()).toEqual(['b', 'z']);
    expect(nav.next()).toBe('z');
    nav.remove('a');
    expect(nav.state.history).toEqual(['z']);
    expect(nav.state.cursor).toBe(0);
    expect(nav.hasPrevious).toBe(false);
    nav.remove('b');
    expect(nav.state.pending).toEqual([]);
    // Eliminar la actual: el reproductor sincroniza con la alternativa de Playlist.
    nav.remove('z');
    expect(nav.state.cursor).toBe(-1);
    nav.sync('q');
    expect(nav.state.history).toEqual(['q']);
  });

  it('reset olvida historial y candidatos', () => {
    const nav = new ShuffleNavigator(sequence());
    nav.start('a', IDS);
    nav.next();
    nav.reset();
    expect(nav.state).toEqual({ history: [], cursor: -1, pending: [] });
    expect(nav.hasNext).toBe(false);
    expect(nav.hasPrevious).toBe(false);
  });
});
