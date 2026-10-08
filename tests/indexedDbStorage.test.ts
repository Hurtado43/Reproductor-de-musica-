import { describe, expect, it } from 'vitest';
import { createSong } from '../src/domain';
import {
  IndexedDbLibraryStorage,
  StorageError,
} from '../src/features/player/persistence/indexedDbStorage';
import { LIBRARY_KEY, SCHEMA_VERSION, toStoredSong } from '../src/features/player/persistence/librarySchema';
import { FakeIDBFactory } from './fakes/fakeIndexedDB';

/*
 * Adaptador de IndexedDB con un IndexedDB SIMULADO y mínimo
 * (tests/fakes/fakeIndexedDB.ts). Comprueba el uso de transacciones, el
 * aborto sin cambios parciales y la gestión de conexiones. IndexedDB real se
 * verificó en el navegador (docs/progreso.md).
 */

const storage = (factory: FakeIDBFactory) =>
  new IndexedDbLibraryStorage(factory as unknown as IDBFactory);

const song = (id: string) =>
  toStoredSong(
    createSong({ title: `T-${id}`, durationSeconds: 3 }, () => id),
    { file: new File([new Uint8Array(4)], `${id}.mp3`, { type: 'audio/mpeg' }), fileName: `${id}.mp3`, durationSeconds: 2.5 },
    1,
  );

const library = (order: string[], revision = 1) => ({
  key: LIBRARY_KEY as typeof LIBRARY_KEY,
  schemaVersion: SCHEMA_VERSION,
  order,
  selectedId: order[0] ?? null,
  volume: 0.5,
  muted: false,
  revision,
  savedAt: 0,
});

describe('IndexedDbLibraryStorage (IndexedDB simulado)', () => {
  it('crea los almacenes y guarda y lee en una sola transacción', async () => {
    const idb = new FakeIDBFactory();
    const s = storage(idb);
    expect(await s.read()).toEqual({ songs: [], library: undefined });
    await s.commit({ put: [song('a'), song('b')], delete: [], library: library(['a', 'b']) });
    const data = await s.read();
    expect(data.songs.map((r) => (r as { id: string }).id).sort()).toEqual(['a', 'b']);
    expect(data.library).toMatchObject({ order: ['a', 'b'], volume: 0.5 });
    expect(idb.opens).toBe(1); // la conexión se reutiliza
  });

  it('una transacción fallida (cuota) no deja nada a medias', async () => {
    const idb = new FakeIDBFactory();
    const s = storage(idb);
    await s.commit({ put: [song('a')], delete: [], library: library(['a']) });
    idb.options.failPut = { key: 'c', error: 'QuotaExceededError' };
    const error = await s
      .commit({ put: [song('b'), song('c')], delete: ['a'], library: library(['b', 'c'], 2) })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe('quota');
    // Ni 'b' se añadió, ni 'a' se borró, ni el orden cambió.
    expect([...idb.store('songs').keys()]).toEqual(['a']);
    expect(idb.store('meta').get('library')).toMatchObject({ order: ['a'], revision: 1 });
  });

  it('sin IndexedDB: error "unavailable"', async () => {
    const s = new IndexedDbLibraryStorage(undefined);
    await expect(s.read()).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('base de una versión más reciente: error "incompatible"', async () => {
    const s = storage(new FakeIDBFactory({ existingVersion: 5 }));
    await expect(s.read()).rejects.toMatchObject({ kind: 'incompatible' });
  });

  it('apertura bloqueada: error "blocked" y la siguiente operación reintenta la apertura', async () => {
    const idb = new FakeIDBFactory({ blocked: true });
    const s = storage(idb);
    await expect(s.read()).rejects.toMatchObject({ kind: 'blocked' });
    idb.options.blocked = false;
    await expect(s.read()).resolves.toEqual({ songs: [], library: undefined });
    expect(idb.opens).toBe(2);
  });

  it('versionchange cierra la conexión y la siguiente operación abre otra', async () => {
    const idb = new FakeIDBFactory();
    const s = storage(idb);
    await s.read();
    idb.fireVersionChange();
    expect(idb.connections[0]!.closed).toBe(true);
    await s.read();
    expect(idb.opens).toBe(2);
    expect(idb.connections[1]!.closed).toBe(false);
  });

  it('close() cierra cuando no hay operaciones en curso, también si se pide durante una', async () => {
    const idb = new FakeIDBFactory();
    const s = storage(idb);
    const pending = s.commit({ put: [song('a')], delete: [], library: library(['a']) });
    s.close(); // durante la transacción: espera a que termine
    await pending;
    await Promise.resolve();
    expect(idb.connections[0]!.closed).toBe(true);
    expect(idb.store('songs').has('a')).toBe(true);
    await s.read(); // reabre si se vuelve a usar (Strict Mode)
    expect(idb.opens).toBe(2);
  });
});
