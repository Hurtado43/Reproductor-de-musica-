import { describe, expect, it } from 'vitest';
import { createSong, DuplicateSongIdError, Playlist, type PlaylistSnapshot, type Song } from '../src/domain';
import { SAMPLE_SONGS } from './fixtures/sampleSongs';

function song(id: string, title = `Canción ${id}`, durationSeconds = 60): Song {
  return { id, title, artist: 'Artista', durationSeconds };
}

function playlistOf(...ids: string[]): Playlist {
  const playlist = new Playlist();
  for (const id of ids) playlist.addLast(song(id));
  return playlist;
}

const ids = (p: Playlist) => p.toArray().map((s) => s.id);

/** Comprueba que el snapshot sea coherente con el estado de la playlist. */
function expectConsistent(p: Playlist, s: PlaylistSnapshot = p.snapshot()) {
  expect(s.songs.map((x) => x.id)).toEqual(ids(p));
  expect(s.currentId).toBe(p.current?.id ?? null);
  expect(s.currentIndex).toBe(p.current ? ids(p).indexOf(p.current.id) : -1);
  expect(s.hasNext).toBe(p.hasNext);
  expect(s.hasPrevious).toBe(p.hasPrevious);
  expect(s.totalDurationSeconds).toBe(p.toArray().reduce((t, x) => t + x.durationSeconds, 0));
}

describe('Playlist: estado inicial', () => {
  it('empieza vacía y sin selección', () => {
    const p = new Playlist();
    expect(p.size).toBe(0);
    expect(p.current).toBeNull();
    expect(p.hasNext).toBe(false);
    expect(p.hasPrevious).toBe(false);
    expect(p.snapshot()).toEqual({
      songs: [],
      currentId: null,
      currentIndex: -1,
      totalDurationSeconds: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });
});

describe('Playlist: inserción y selección', () => {
  it('la primera inserción selecciona la canción', () => {
    for (const add of [
      (p: Playlist) => p.addFirst(song('a')),
      (p: Playlist) => p.addLast(song('a')),
      (p: Playlist) => p.addAt(0, song('a')),
    ]) {
      const p = new Playlist();
      add(p);
      expect(p.current?.id).toBe('a');
      expectConsistent(p);
    }
  });

  it('las demás inserciones conservan la selección', () => {
    const p = playlistOf('b');
    p.addFirst(song('a'));
    p.addLast(song('d'));
    p.addAt(2, song('c'));
    expect(ids(p)).toEqual(['a', 'b', 'c', 'd']);
    expect(p.current?.id).toBe('b');
    expectConsistent(p);
  });

  it('add usa por defecto el final y acepta las tres ubicaciones', () => {
    const p = new Playlist();
    p.add(song('b'));
    p.add(song('a'), { kind: 'first' });
    p.add(song('c'), { kind: 'last' });
    p.add(song('x'), { kind: 'at', index: 1 });
    expect(ids(p)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('permite títulos repetidos con ids distintos', () => {
    const p = new Playlist();
    p.addLast(song('1', 'Igual'));
    p.addLast(song('2', 'Igual'));
    expect(p.toArray().map((s) => s.title)).toEqual(['Igual', 'Igual']);
    expect(p.size).toBe(2);
  });

  it('rechaza un id duplicado sin modificar el estado', () => {
    const p = playlistOf('a', 'b');
    p.select('b');
    const before = p.snapshot();
    expect(() => p.addFirst(song('a', 'Otro título'))).toThrow(DuplicateSongIdError);
    expect(() => p.addAt(1, song('b'))).toThrow(DuplicateSongIdError);
    expect(p.snapshot()).toEqual(before);
  });

  it.each([-1, 3, 1.5, Number.NaN])('rechaza la posición interna %s sin modificar el estado', (index) => {
    const p = playlistOf('a', 'b');
    const before = p.snapshot();
    expect(() => p.addAt(index, song('x'))).toThrow(RangeError);
    expect(p.snapshot()).toEqual(before);
    expect(p.has('x')).toBe(false);
    // El id rechazado puede usarse después en una inserción válida.
    p.addLast(song('x'));
    expect(ids(p)).toEqual(['a', 'b', 'x']);
  });

  it('una inserción inválida en una playlist vacía no selecciona nada', () => {
    const p = new Playlist();
    expect(() => p.addAt(1, song('a'))).toThrow(RangeError);
    expect(p.current).toBeNull();
    expect(p.size).toBe(0);
  });
});

describe('Playlist: selección y navegación', () => {
  it('select elige una canción por id', () => {
    const p = playlistOf('a', 'b', 'c');
    expect(p.select('c')).toBe(true);
    expect(p.current?.id).toBe('c');
    expectConsistent(p);
  });

  it('select con un id inexistente no cambia la selección', () => {
    const p = playlistOf('a', 'b');
    p.select('b');
    expect(p.select('zzz')).toBe(false);
    expect(p.current?.id).toBe('b');
  });

  it('next y previous recorren la lista en ambos sentidos', () => {
    const p = playlistOf('a', 'b', 'c');
    const forward = [p.current?.id];
    while (p.next()) forward.push(p.current?.id);
    expect(forward).toEqual(['a', 'b', 'c']);
    const backward = [p.current?.id];
    while (p.previous()) backward.push(p.current?.id);
    expect(backward).toEqual(['c', 'b', 'a']);
  });

  it('no navega fuera de los extremos', () => {
    const p = playlistOf('a', 'b');
    expect(p.hasPrevious).toBe(false);
    expect(p.previous()).toBe(false);
    expect(p.current?.id).toBe('a');
    p.next();
    expect(p.hasNext).toBe(false);
    expect(p.next()).toBe(false);
    expect(p.current?.id).toBe('b');
    expectConsistent(p);
  });

  it('con una sola canción no hay anterior ni siguiente', () => {
    const p = playlistOf('a');
    expect(p.next()).toBe(false);
    expect(p.previous()).toBe(false);
    expect(p.current?.id).toBe('a');
  });

  it('sin canciones, next y previous no hacen nada', () => {
    const p = new Playlist();
    expect(p.next()).toBe(false);
    expect(p.previous()).toBe(false);
    expect(p.current).toBeNull();
  });

  it('la navegación sigue los enlaces tras inserciones intermedias', () => {
    const p = playlistOf('a', 'c');
    p.addAt(1, song('b'));
    expect(p.next()).toBe(true);
    expect(p.current?.id).toBe('b');
    p.addAt(2, song('b2'));
    expect(p.next()).toBe(true);
    expect(p.current?.id).toBe('b2');
  });
});

describe('Playlist: eliminación', () => {
  it('eliminar la actual selecciona la siguiente', () => {
    const p = playlistOf('a', 'b', 'c');
    p.select('b');
    expect(p.remove('b')).toBe(true);
    expect(p.current?.id).toBe('c');
    expect(ids(p)).toEqual(['a', 'c']);
    expectConsistent(p);
  });

  it('eliminar la actual cuando es la última selecciona la anterior', () => {
    const p = playlistOf('a', 'b', 'c');
    p.select('c');
    p.remove('c');
    expect(p.current?.id).toBe('b');
    expect(p.hasNext).toBe(false);
    expectConsistent(p);
  });

  it('eliminar la actual cuando es la primera selecciona la nueva primera', () => {
    const p = playlistOf('a', 'b');
    p.remove('a');
    expect(p.current?.id).toBe('b');
    expect(p.hasPrevious).toBe(false);
  });

  it('eliminar la única canción deja la selección vacía', () => {
    const p = playlistOf('a');
    p.remove('a');
    expect(p.current).toBeNull();
    expect(p.size).toBe(0);
    expectConsistent(p);
  });

  it('eliminar otra canción conserva la selección', () => {
    const p = playlistOf('a', 'b', 'c', 'd');
    p.select('c');
    p.remove('a');
    expect(p.current?.id).toBe('c');
    p.remove('d');
    expect(p.current?.id).toBe('c');
    expect(ids(p)).toEqual(['b', 'c']);
    expectConsistent(p);
  });

  it('eliminar un id inexistente o ya eliminado no cambia el estado', () => {
    const p = playlistOf('a', 'b');
    p.remove('a');
    const before = p.snapshot();
    expect(p.remove('a')).toBe(false);
    expect(p.remove('nunca')).toBe(false);
    expect(p.snapshot()).toEqual(before);
  });

  it('un id eliminado se puede volver a usar', () => {
    const p = playlistOf('a', 'b');
    p.remove('a');
    p.addFirst(song('a'));
    expect(ids(p)).toEqual(['a', 'b']);
  });

  it('eliminar en cadena la actual recorre hacia adelante y luego hacia atrás', () => {
    const p = playlistOf('a', 'b', 'c');
    p.select('b');
    const seen: (string | undefined)[] = [];
    while (p.current) {
      seen.push(p.current.id);
      p.remove(p.current.id);
    }
    expect(seen).toEqual(['b', 'c', 'a']);
    expect(p.size).toBe(0);
  });

  it('la navegación funciona después de eliminar la actual', () => {
    const p = playlistOf('a', 'b', 'c', 'd');
    p.select('b');
    p.remove('b'); // actual: c
    expect(p.previous()).toBe(true);
    expect(p.current?.id).toBe('a');
    expect(p.next()).toBe(true);
    expect(p.next()).toBe(true);
    expect(p.current?.id).toBe('d');
  });
});

describe('Playlist: vaciar y snapshot', () => {
  it('clear vacía la playlist, la selección y los ids', () => {
    const p = playlistOf('a', 'b');
    p.clear();
    expectConsistent(p);
    expect(p.current).toBeNull();
    p.addLast(song('a'));
    expect(p.current?.id).toBe('a');
  });

  it('cada snapshot es un objeto nuevo e inmutable', () => {
    const p = playlistOf('a');
    const first = p.snapshot();
    p.addLast(song('b', 'B', 30));
    const second = p.snapshot();
    expect(second).not.toBe(first);
    expect(first.songs).toHaveLength(1);
    expect(second.songs).toHaveLength(2);
    expect(second.totalDurationSeconds).toBe(90);
    expect(Object.isFrozen(second)).toBe(true);
    expect(Object.isFrozen(second.songs)).toBe(true);
  });

  it('el snapshot solo contiene datos planos serializables', () => {
    const p = playlistOf('a', 'b');
    const snapshot = p.snapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('secuencia combinada coherente con un modelo de arreglo', () => {
    let seed = 7;
    const rand = (max: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % max;
    };
    const p = new Playlist();
    const model: string[] = [];
    let current: string | null = null;
    for (let step = 0; step < 400; step++) {
      const op = rand(6);
      const id = `s${step}`;
      if (op === 0) {
        p.addFirst(song(id));
        model.unshift(id);
        current ??= id;
      } else if (op === 1) {
        p.addLast(song(id));
        model.push(id);
        current ??= id;
      } else if (op === 2) {
        const i = rand(model.length + 1);
        p.addAt(i, song(id));
        model.splice(i, 0, id);
        current ??= id;
      } else if (op === 3 && model.length > 0) {
        const i = rand(model.length);
        const removed = model[i]!;
        p.remove(removed);
        model.splice(i, 1);
        if (removed === current) current = model[i] ?? model[i - 1] ?? null;
      } else if (op === 4) {
        const i = model.indexOf(current ?? '');
        if (p.next()) current = model[i + 1]!;
      } else if (op === 5) {
        const i = model.indexOf(current ?? '');
        if (p.previous()) current = model[i - 1]!;
      }
      expect(ids(p)).toEqual(model);
      expect(p.current?.id ?? null).toBe(current);
      expectConsistent(p);
    }
  });
});

describe('Playlist con las canciones ficticias de las fixtures', () => {
  it('suma las duraciones y conserva el orden', () => {
    const p = new Playlist();
    SAMPLE_SONGS.forEach((input, i) => p.addLast(createSong(input, () => `f${i}`)));
    const snapshot = p.snapshot();
    expect(snapshot.songs.map((s) => s.title)).toEqual(SAMPLE_SONGS.map((s) => s.title));
    expect(snapshot.totalDurationSeconds).toBe(1105);
    expect(snapshot.currentId).toBe('f0');
  });
});
