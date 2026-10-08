import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSong, type Song } from '../src/domain';
import type { AudioSource } from '../src/features/player/audio/sourceRegistry';
import { LibraryPersistence, type LibraryState } from '../src/features/player/persistence/LibraryPersistence';
import { SCHEMA_VERSION, toStoredSong } from '../src/features/player/persistence/librarySchema';
import { FakeLibraryStorage } from './fakes/fakeLibraryStorage';

/*
 * Coordinador de persistencia con un almacenamiento SIMULADO en memoria
 * (tests/fakes/fakeLibraryStorage.ts): transacciones todo o nada, fallos y
 * esperas controlados. No es IndexedDB real.
 */

afterEach(() => {
  vi.useRealTimers();
});

const entry = (id: string, title = `Canción ${id}`): { song: Song; source: AudioSource } => ({
  song: createSong({ title, durationSeconds: 5 }, () => id),
  source: {
    file: new File([new Uint8Array(8).fill(id.charCodeAt(0))], `${id}.mp3`, { type: 'audio/mpeg' }),
    fileName: `${id}.mp3`,
    durationSeconds: 4.2,
  },
});

const state = (ids: string[], selectedId: string | null = ids[0] ?? null, volume = 1, muted = false): LibraryState => ({
  songs: ids.map((id) => entry(id)),
  selectedId,
  volume,
  muted,
  repeatMode: 'off',
  shuffle: false,
});

async function ready(storage = new FakeLibraryStorage()) {
  const persistence = new LibraryPersistence(storage, { preferenceDelayMs: 300 });
  const outcome = await persistence.restore();
  return { storage, persistence, outcome };
}

/** Deja correr las microtareas sin esperar transacciones retenidas. */
const microtasks = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

const settle = async (p: LibraryPersistence) => {
  for (let i = 0; i < 5; i++) await p.idle;
};

describe('restauración', () => {
  it('se lee una sola vez aunque se pida varias veces (Strict Mode)', async () => {
    const storage = new FakeLibraryStorage();
    const persistence = new LibraryPersistence(storage);
    const [a, b] = await Promise.all([persistence.restore(), persistence.restore()]);
    expect(a).toBe(b);
    expect(storage.reads).toBe(1);
    expect(persistence.getSnapshot().status).toEqual({ kind: 'ready', restoredCount: 0 });
  });

  it('no guarda nada mientras restaura (la playlist vacía inicial no pisa los datos)', async () => {
    const storage = new FakeLibraryStorage();
    storage.holdRead = true;
    const persistence = new LibraryPersistence(storage);
    const restoring = persistence.restore();
    persistence.requestSave(state([]));
    persistence.requestSave(state([]), { preferences: true });
    expect(persistence.getSnapshot().status.kind).toBe('restoring');
    storage.releaseRead();
    await restoring;
    await settle(persistence);
    expect(storage.commits).toHaveLength(0);
  });
});

describe('guardado', () => {
  it('importar guarda canción y archivo junto con el orden; "Guardado" al terminar la transacción', async () => {
    const { storage, persistence } = await ready();
    storage.holdCommits = true;
    persistence.requestSave(state(['a']));
    expect(persistence.getSnapshot().status.kind).toBe('saving');
    storage.releaseCommit();
    await settle(persistence);
    expect(persistence.getSnapshot().status.kind).toBe('saved');
    expect(storage.commits[0]!.put.map((r) => r.id)).toEqual(['a']);
    expect(storage.songs.get('a')!.file).toBeInstanceOf(File);
    expect(storage.library).toMatchObject({ order: ['a'], selectedId: 'a', schemaVersion: SCHEMA_VERSION });
  });

  it('inserción al inicio, al final y en posición: el orden guardado sigue a la playlist', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a']));
    await settle(persistence);
    persistence.requestSave(state(['b', 'a'])); // al inicio
    await settle(persistence);
    persistence.requestSave(state(['b', 'a', 'c'])); // al final
    await settle(persistence);
    persistence.requestSave(state(['b', 'd', 'a', 'c'])); // en la posición 2
    await settle(persistence);
    expect(storage.order).toEqual(['b', 'd', 'a', 'c']);
    // Cada MP3 se escribió una sola vez.
    expect(storage.commits.flatMap((c) => c.put.map((r) => r.id))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('cambiar selección o preferencias no vuelve a escribir los MP3', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a', 'b']));
    await settle(persistence);
    persistence.requestSave(state(['a', 'b'], 'b'));
    await settle(persistence);
    expect(storage.commits[1]!.put).toEqual([]);
    expect(storage.commits[1]!.delete).toEqual([]);
    expect(storage.library).toMatchObject({ selectedId: 'b' });
  });

  it('agrupa los cambios de volumen y silencio en una sola escritura', async () => {
    vi.useFakeTimers();
    const { storage, persistence } = await ready();
    for (const v of [0.9, 0.8, 0.7, 0.6]) persistence.requestSave(state([], null, v), { preferences: true });
    persistence.requestSave(state([], null, 0.6, true), { preferences: true });
    await vi.advanceTimersByTimeAsync(299);
    expect(storage.commits).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await settle(persistence);
    expect(storage.commits).toHaveLength(1);
    expect(storage.library).toMatchObject({ volume: 0.6, muted: true });
  });

  it('eliminar borra el archivo en la misma transacción; eliminar la última deja la biblioteca vacía', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a', 'b']));
    await settle(persistence);
    persistence.requestSave(state(['b']));
    await settle(persistence);
    expect([...storage.songs.keys()]).toEqual(['b']);
    expect(storage.order).toEqual(['b']);
    persistence.requestSave(state([], null));
    await settle(persistence);
    expect(storage.songs.size).toBe(0);
    expect(storage.library).toMatchObject({ order: [], selectedId: null });
  });

  it('sin cambios no escribe', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a']));
    await settle(persistence);
    persistence.requestSave(state(['a']));
    persistence.requestSave(state(['a']), { preferences: true });
    await settle(persistence);
    expect(storage.commits).toHaveLength(1);
  });

  it('escrituras rápidas: una transacción a la vez y siempre con el estado más reciente', async () => {
    const { storage, persistence } = await ready();
    storage.holdCommits = true;
    persistence.requestSave(state(['a']));
    persistence.requestSave(state(['a', 'b']));
    persistence.requestSave(state(['a', 'b', 'c'], 'c'));
    persistence.requestSave(state(['b', 'c'], 'c'));
    expect(storage.heldCommits).toHaveLength(1); // no se cruzan
    storage.releaseCommit();
    await microtasks();
    expect(storage.heldCommits).toHaveLength(1);
    storage.releaseCommit();
    await microtasks();
    expect(storage.commits).toHaveLength(2); // los intermedios se fusionaron
    expect(storage.order).toEqual(['b', 'c']);
    expect(storage.library).toMatchObject({ selectedId: 'c' });
    expect([...storage.songs.keys()].sort()).toEqual(['b', 'c']);
    const revisions = storage.commits.map((c) => c.library.revision);
    expect(revisions).toEqual([1, 2]);
    expect(persistence.getSnapshot().status.kind).toBe('saved');
  });
});

describe('fallos y reintento', () => {
  it('transacción fallida: nada parcial, error visible y "Reintentar" guarda el estado vigente', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a']));
    await settle(persistence);

    storage.failNext('quota');
    persistence.requestSave(state(['a', 'b'], 'b'));
    await settle(persistence);
    expect(storage.order).toEqual(['a']);
    expect(storage.songs.has('b')).toBe(false);
    const status = persistence.getSnapshot().status;
    expect(status).toMatchObject({ kind: 'error', retry: 'save' });
    expect(status.kind === 'error' && status.message).toMatch(/espacio/);
    expect(status.kind === 'error' && status.message).toMatch(/podrían perderse al recargar/);

    // Otro cambio mientras hay error (todavía falla).
    storage.failNext('aborted');
    persistence.requestSave(state(['a', 'b', 'c'], 'c'));
    await settle(persistence);
    expect(persistence.getSnapshot().status.kind).toBe('error');

    persistence.retrySave();
    await settle(persistence);
    expect(persistence.getSnapshot().status.kind).toBe('saved');
    expect(storage.order).toEqual(['a', 'b', 'c']);
    expect(storage.library).toMatchObject({ selectedId: 'c' });
    expect([...storage.songs.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('IndexedDB no disponible: la sesión sigue en memoria y no se dice "Guardado"', async () => {
    const storage = new FakeLibraryStorage();
    storage.failRead('unavailable');
    const { persistence, outcome } = await ready(storage);
    expect(outcome.kind).toBe('restored');
    persistence.requestSave(state(['a']));
    await settle(persistence);
    expect(storage.commits).toHaveLength(0);
    expect(persistence.getSnapshot().status).toMatchObject({ kind: 'off' });
  });

  it('lectura fallida: no se escribe encima; se puede reintentar la restauración', async () => {
    const storage = new FakeLibraryStorage();
    storage.failRead('blocked');
    const { persistence, outcome } = await ready(storage);
    expect(outcome.kind).toBe('failed');
    expect(persistence.getSnapshot().status).toMatchObject({ kind: 'error', retry: 'restore' });
    persistence.requestSave(state([]));
    expect(storage.commits).toHaveLength(0);

    storage.failRead(null);
    persistence.retryRestore();
    expect(persistence.getSnapshot()).toMatchObject({ status: { kind: 'restoring' }, restoreAttempt: 1 });
    expect((await persistence.restore()).kind).toBe('restored');
    expect(storage.reads).toBe(2);
  });

  it('lectura fallida y luego canciones nuevas: se informa que no se guardarán', async () => {
    const storage = new FakeLibraryStorage();
    storage.failRead('failed');
    const { persistence } = await ready(storage);
    persistence.requestSave(state(['a']));
    expect(persistence.getSnapshot().status).toMatchObject({ kind: 'off' });
    expect(storage.commits).toHaveLength(0);
  });

  it('versión incompatible: no se modifica nada', async () => {
    const storage = new FakeLibraryStorage();
    storage.meta.set('library', { key: 'library', schemaVersion: SCHEMA_VERSION + 1, order: [] });
    const { persistence } = await ready(storage);
    persistence.requestSave(state(['a']));
    await settle(persistence);
    expect(storage.commits).toHaveLength(0);
    expect(persistence.getSnapshot().status.kind).toBe('off');
  });

  it('datos dañados: guarda una copia del registro original y no borra las entradas inválidas', async () => {
    const storage = new FakeLibraryStorage();
    const good = entry('a');
    storage.songs.set('a', { ...toStoredSong(good.song, good.source, 1) });
    storage.songs.set('rota', { id: 'rota', title: 'Rota', file: new Blob([]) });
    const original = { key: 'library', schemaVersion: 1, order: ['a', 'rota'], selectedId: 'rota', volume: 0.5, muted: false, revision: 7 };
    storage.meta.set('library', original);
    const { persistence, outcome } = await ready(storage);
    expect(outcome.kind === 'restored' && outcome.library.entries.map((e) => e.song.id)).toEqual(['a']);
    expect(persistence.getSnapshot().report.length).toBeGreaterThan(0);

    persistence.requestSave({ songs: [good], selectedId: 'a', volume: 0.5, muted: false, repeatMode: 'off', shuffle: false });
    await settle(persistence);
    const commit = storage.commits[0]!;
    expect(commit.backup?.original).toBe(original);
    expect(commit.delete).toEqual([]);
    expect(storage.songs.has('rota')).toBe(true); // no se borra en silencio
    expect(storage.library).toMatchObject({ order: ['a'], selectedId: 'a', revision: 8 });
    expect([...storage.meta.keys()].some((k) => k.startsWith('library-before-recovery-'))).toBe(true);
  });
});

describe('liberación', () => {
  it('dispose guarda lo pendiente de agrupar y cierra la conexión', async () => {
    vi.useFakeTimers();
    const { storage, persistence } = await ready();
    persistence.requestSave(state([], null, 0.3), { preferences: true });
    persistence.dispose();
    await vi.advanceTimersByTimeAsync(0);
    await settle(persistence);
    expect(storage.library).toMatchObject({ volume: 0.3 });
    expect(storage.closes).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('modo de repetición (fase 4B)', () => {
  it('se guarda como preferencia agrupada, sin reescribir los MP3', async () => {
    vi.useFakeTimers();
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a']));
    await settle(persistence);
    persistence.requestSave({ ...state(['a']), repeatMode: 'all' }, { preferences: true });
    persistence.requestSave({ ...state(['a']), repeatMode: 'one' }, { preferences: true });
    await vi.advanceTimersByTimeAsync(300);
    await settle(persistence);
    expect(storage.commits).toHaveLength(2);
    expect(storage.commits[1]!.put).toEqual([]);
    expect(storage.library).toMatchObject({ repeatMode: 'one', schemaVersion: SCHEMA_VERSION });
  });

  it('vaciar: una transacción borra todos los archivos y guarda el orden vacío con las preferencias', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave({ ...state(['a', 'b', 'c']), volume: 0.4, muted: true, repeatMode: 'all' });
    await settle(persistence);
    persistence.requestSave({ songs: [], selectedId: null, volume: 0.4, muted: true, repeatMode: 'all', shuffle: false });
    await settle(persistence);
    const last = storage.commits[storage.commits.length - 1]!;
    expect([...last.delete].sort()).toEqual(['a', 'b', 'c']);
    expect(storage.songs.size).toBe(0);
    expect(storage.library).toMatchObject({ order: [], selectedId: null, volume: 0.4, muted: true, repeatMode: 'all' });
  });
});

describe('aleatorio (fase 5)', () => {
  it('se guarda como preferencia (solo el booleano), sin reescribir los MP3', async () => {
    const { storage, persistence } = await ready();
    persistence.requestSave(state(['a', 'b']));
    await settle(persistence);
    persistence.requestSave({ ...state(['a', 'b']), shuffle: true }, { preferences: true });
    await new Promise((r) => setTimeout(r, 350));
    await settle(persistence);
    expect(storage.commits).toHaveLength(2);
    expect(storage.commits[1]!.put).toEqual([]);
    expect(storage.library).toMatchObject({ shuffle: true, order: ['a', 'b'] });
    expect(Object.keys(storage.library!)).not.toContain('history');
  });
});
