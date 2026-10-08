import { describe, expect, it } from 'vitest';
import { createSong, DuplicateSongIdError, type InsertPlacement } from '../src/domain';
import { AudioSourceRegistry } from '../src/features/player/audio/sourceRegistry';
import { PlaylistController, type ImportSongRequest } from '../src/features/player/playlistController';
import { toDomainDurationSeconds } from '../src/features/player/songForm';

function sequentialIds() {
  let n = 0;
  return () => `id-${++n}`;
}

function file(name: string) {
  return new File([new Uint8Array([0x49, 0x44, 0x33, 4, 0])], name, { type: 'audio/mpeg' });
}

function request(
  title: string,
  options: { file?: File; precise?: number; placement?: InsertPlacement; artist?: string } = {},
): ImportSongRequest {
  const f = options.file ?? file(`${title}.mp3`);
  const precise = options.precise ?? 61.25;
  return {
    input: { title, artist: options.artist ?? '', durationSeconds: toDomainDurationSeconds(precise) },
    placement: options.placement ?? { kind: 'last' },
    source: { file: f, fileName: f.name, durationSeconds: precise },
  };
}

/** Cada canción tiene exactamente una fuente y no hay fuentes huérfanas. */
function expectConsistent(c: PlaylistController) {
  const songIds = c.snapshot().songs.map((s) => s.id);
  expect([...c.sourceIds()].sort()).toEqual([...songIds].sort());
}

describe('PlaylistController: importación', () => {
  it('asocia canción y archivo por id', () => {
    const c = new PlaylistController(sequentialIds());
    const f = file('tema.mp3');
    const song = c.importSong(request('Tema', { file: f, precise: 204.83 }));
    expect(song.id).toBe('id-1');
    expect(c.getSource('id-1')).toEqual({ file: f, fileName: 'tema.mp3', durationSeconds: 204.83 });
    expect(c.getSource('id-1')!.file).toBe(f);
    expectConsistent(c);
  });

  it('la canción guarda segundos enteros (hacia arriba) y la fuente la duración precisa', () => {
    const c = new PlaylistController(sequentialIds());
    const song = c.importSong(request('Tema', { precise: 204.01 }));
    expect(song.durationSeconds).toBe(205);
    expect(c.getSource(song.id)!.durationSeconds).toBe(204.01);
    expect(c.snapshot().totalDurationSeconds).toBe(205);
  });

  it('sin artista se guarda null (no se inventa)', () => {
    const c = new PlaylistController(sequentialIds());
    expect(c.importSong(request('Tema', { artist: '   ' })).artist).toBeNull();
  });

  it('respeta inicio, final y posición, y la primera importación selecciona', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('B'));
    c.importSong(request('A', { placement: { kind: 'first' } }));
    c.importSong(request('D'));
    c.importSong(request('C', { placement: { kind: 'at', index: 2 } }));
    const s = c.snapshot();
    expect(s.songs.map((x) => x.title)).toEqual(['A', 'B', 'C', 'D']);
    expect(s.songs[s.currentIndex]!.title).toBe('B');
    expectConsistent(c);
  });

  it('el mismo archivo importado dos veces da dos canciones con ids distintos', () => {
    const c = new PlaylistController(sequentialIds());
    const f = file('repetido.mp3');
    const a = c.importSong(request('Repetido', { file: f }));
    const b = c.importSong(request('Repetido', { file: f }));
    expect(a.id).not.toBe(b.id);
    expect(c.size).toBe(2);
    expect(c.getSource(a.id)!.file).toBe(f);
    expect(c.getSource(b.id)!.file).toBe(f);
    expectConsistent(c);
  });
});

describe('PlaylistController: fallos sin huérfanas', () => {
  it('posición inválida: ni canción ni fuente', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('A'));
    expect(() => c.importSong(request('X', { placement: { kind: 'at', index: 5 } }))).toThrow(RangeError);
    expect(c.size).toBe(1);
    expect(c.getSource('id-2')).toBeUndefined();
    expectConsistent(c);
  });

  it('título inválido: ni canción ni fuente', () => {
    const c = new PlaylistController(sequentialIds());
    expect(() => c.importSong(request('   '))).toThrow('El título no puede estar vacío.');
    expect(c.size).toBe(0);
    expect(c.sourceIds()).toEqual([]);
  });

  it('id duplicado: la segunda importación no deja nodo ni fuente', () => {
    const c = new PlaylistController(() => 'siempre-igual');
    const f1 = file('uno.mp3');
    c.importSong(request('Uno', { file: f1 }));
    expect(() => c.importSong(request('Dos'))).toThrow(DuplicateSongIdError);
    expect(c.size).toBe(1);
    expect(c.getSource('siempre-igual')!.file).toBe(f1);
    expectConsistent(c);
  });

  it('una posición inválida no cambia la selección', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('A'));
    c.importSong(request('B'));
    c.selectSong('id-2');
    const before = c.snapshot();
    expect(() => c.importSong(request('X', { placement: { kind: 'at', index: -1 } }))).toThrow();
    expect(c.snapshot()).toEqual(before);
  });
});

describe('PlaylistController: eliminación, selección y navegación', () => {
  it('eliminar una canción retira también su fuente', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('A'));
    c.importSong(request('B'));
    expect(c.removeSong('id-1')).toBe(true);
    expect(c.getSource('id-1')).toBeUndefined();
    expect(c.getSource('id-2')).toBeDefined();
    expectConsistent(c);
  });

  it('eliminar un id inexistente no cambia nada', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('A'));
    expect(c.removeSong('nada')).toBe(false);
    expect(c.sourceIds()).toEqual(['id-1']);
  });

  it('la selección sigue las reglas de Playlist', () => {
    const c = new PlaylistController(sequentialIds());
    for (const t of ['A', 'B', 'C']) c.importSong(request(t));
    expect(c.selectSong('id-2')).toBe(true);
    c.importSong(request('Antes', { placement: { kind: 'first' } }));
    c.removeSong('id-3');
    expect(c.snapshot().currentId).toBe('id-2');
    expect(c.next()).toBe(false); // id-2 es ahora la última
    expect(c.previous()).toBe(true);
    expect(c.snapshot().currentId).toBe('id-1');
    c.selectSong('id-1');
    c.removeSong('id-1');
    expect(c.snapshot().currentId).toBe('id-2'); // la siguiente
  });

  it('secuencia combinada: siempre una fuente por canción', () => {
    let seed = 3;
    const rand = (max: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % max;
    };
    const c = new PlaylistController(sequentialIds());
    for (let step = 0; step < 200; step++) {
      const op = rand(4);
      const ids = c.snapshot().songs.map((s) => s.id);
      if (op <= 1) {
        const index = rand(ids.length + 3) - 1; // incluye índices inválidos
        try {
          c.importSong(request(`T${step}`, { placement: { kind: 'at', index } }));
        } catch {
          // posición inválida: no debe cambiar nada
        }
      } else if (op === 2 && ids.length > 0) {
        c.removeSong(ids[rand(ids.length)]!);
      } else if (ids.length > 0) {
        c.selectSong(ids[rand(ids.length)]!);
      }
      expectConsistent(c);
    }
  });
});

describe('AudioSourceRegistry', () => {
  it('no acepta dos fuentes con el mismo id', () => {
    const registry = new AudioSourceRegistry();
    const source = { file: file('a.mp3'), fileName: 'a.mp3', durationSeconds: 1 };
    registry.add('x', source);
    expect(() => registry.add('x', source)).toThrow();
    expect(registry.size).toBe(1);
    expect(registry.delete('x')).toBe(true);
    expect(registry.delete('x')).toBe(false);
  });
});

describe('PlaylistController: restauración (fase 4A)', () => {
  const restored = (id: string, title: string) => {
    const f = file(`${title}.mp3`);
    return { song: createSong({ title, durationSeconds: 3 }, () => id), source: { file: f, fileName: f.name, durationSeconds: 2.5 } };
  };

  it('reconstruye la lista enlazada en orden, con sus archivos y la selección', () => {
    const c = new PlaylistController(sequentialIds());
    c.restore([restored('a', 'Uno'), restored('b', 'Dos'), restored('c', 'Dos')], 'b');
    const snap = c.snapshot();
    expect(snap.songs.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(snap.currentId).toBe('b');
    // Los enlaces prev/next funcionan desde la selección restaurada.
    expect(c.next()).toBe(true);
    expect(c.currentId).toBe('c');
    expect(c.previous() && c.previous()).toBe(true);
    expect(c.currentId).toBe('a');
    expectConsistent(c);
    // Las importaciones posteriores siguen funcionando.
    c.importSong(request('Nueva', { placement: { kind: 'at', index: 1 } }));
    expect(c.snapshot().songs.map((s) => s.id)).toEqual(['a', 'id-1', 'b', 'c']);
  });

  it('sin selección válida queda la primera; vacía, null', () => {
    const c = new PlaylistController(sequentialIds());
    c.restore([restored('a', 'Uno'), restored('b', 'Dos')], 'no-existe');
    expect(c.currentId).toBe('a');
    const empty = new PlaylistController(sequentialIds());
    empty.restore([], null);
    expect(empty.currentId).toBeNull();
  });

  it('rechaza restaurar sobre una playlist con canciones o con ids repetidos, sin cambios', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('Existente'));
    expect(() => c.restore([restored('a', 'Uno')], 'a')).toThrow();
    expect(c.snapshot().songs.map((s) => s.id)).toEqual(['id-1']);
    const d = new PlaylistController(sequentialIds());
    expect(() => d.restore([restored('a', 'Uno'), restored('a', 'Otra')], null)).toThrow();
    expect(d.size).toBe(0);
    expect(d.sourceIds()).toEqual([]);
  });
});

describe('PlaylistController: vaciar (fase 4B)', () => {
  it('quita canciones, selección y fuentes; permite importar después', () => {
    const c = new PlaylistController(sequentialIds());
    c.importSong(request('Uno'));
    c.importSong(request('Dos'));
    expect(c.clear()).toBe(true);
    expect(c.snapshot()).toMatchObject({ songs: [], currentId: null, currentIndex: -1 });
    expect(c.sourceIds()).toEqual([]);
    expect(c.clear()).toBe(false);
    c.importSong(request('Tres'));
    expect(c.currentId).toBe('id-3');
    expectConsistent(c);
  });
});
