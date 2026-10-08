// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createSong } from '../src/domain';
import type { ReadAudioMetadata } from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';
import { SCHEMA_VERSION, toStoredSong } from '../src/features/player/persistence/librarySchema';
import { FakeLibraryStorage } from './fakes/fakeLibraryStorage';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Reproductor con persistencia y almacenamiento SIMULADO en memoria
 * (tests/fakes/fakeLibraryStorage.ts, no IndexedDB), un elemento de audio
 * simulado y un lector de metadatos simulado. IndexedDB real y los MP3 reales
 * se verificaron en el navegador (docs/progreso.md).
 */

afterEach(cleanup);

const mp3 = (name: string, fill = 1) => new File([new Uint8Array(64).fill(fill)], name, { type: 'audio/mpeg' });

function seed(storage: FakeLibraryStorage, songs: { id: string; title: string }[], extra: Record<string, unknown> = {}) {
  songs.forEach(({ id, title }, i) => {
    const song = createSong({ title, durationSeconds: 30 }, () => id);
    storage.songs.set(id, { ...toStoredSong(song, { file: mp3(`${title}.mp3`, i + 1), fileName: `${title}.mp3`, durationSeconds: 29.5 }, i) });
  });
  storage.meta.set('library', {
    key: 'library',
    schemaVersion: SCHEMA_VERSION,
    order: songs.map((s) => s.id),
    selectedId: songs[0]?.id ?? null,
    volume: 1,
    muted: false,
    revision: 1,
    savedAt: 0,
    ...extra,
  });
}

function setup(storage = new FakeLibraryStorage(), { strict = true } = {}) {
  const fake = fakePlaybackEnvironment();
  const pending: ((s: number) => Promise<void>)[] = [];
  const read: ReadAudioMetadata = () =>
    new Promise((resolve) => {
      pending.push((s) => act(async () => resolve({ durationSeconds: s })));
    });
  let n = 0;
  const user = userEvent.setup({ delay: null });
  const tree = (
    <Player
      generateId={() => `nuevo-${++n}`}
      readMetadata={read}
      playbackEnvironment={fake.env}
      libraryStorage={storage}
      persistenceOptions={{ preferenceDelayMs: 0 }}
    />
  );
  const utils = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { user, fake, storage, resolveRead: (s: number) => pending[pending.length - 1]!(s), ...utils };
}
type Ctx = ReturnType<typeof setup>;

const persistenceText = () => screen.getByTestId('persistence-status').textContent;
const rows = () =>
  screen
    .queryAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-song-id'))
    .map((li) => ({
    id: li.getAttribute('data-song-id'),
    current: within(li).queryByRole('button', { current: true }) !== null,
  }));
const addButton = () => screen.getByRole('button', { name: 'Agregar canción' }) as HTMLButtonElement;
const volume = () => screen.getByRole('slider', { name: 'Volumen' }) as HTMLInputElement;
const muteButton = () => screen.getByRole('button', { name: 'Silenciar' }) as HTMLButtonElement;

async function saved() {
  await waitFor(() => expect(persistenceText()).toBe('Guardado en este navegador'));
}

async function importSong(ctx: Ctx, name: string, placement?: 'Al inicio' | 'En una posición', position?: string) {
  await ctx.user.click(addButton());
  const dialog = screen.getByRole('dialog');
  await ctx.user.upload(within(dialog).getByLabelText('Archivo MP3'), mp3(name));
  await ctx.resolveRead(12.3);
  if (placement) await ctx.user.click(within(dialog).getByLabelText(placement));
  if (position) {
    const field = within(dialog).getByLabelText(/Posición/);
    await ctx.user.clear(field);
    await ctx.user.type(field, position);
  }
  await ctx.user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
}

describe('restauración en el reproductor', () => {
  it('biblioteca vacía: sin canciones y listo para guardar', async () => {
    setup();
    await waitFor(() => expect(persistenceText()).toBe('Se guardará en este navegador'));
    expect(rows()).toEqual([]);
    expect(addButton().disabled).toBe(false);
  });

  it('mientras restaura: estado accesible y operaciones que compiten deshabilitadas', async () => {
    const storage = new FakeLibraryStorage();
    storage.holdRead = true;
    seed(storage, [{ id: 'a', title: 'Uno' }]);
    setup(storage);
    expect(persistenceText()).toBe('Restaurando la biblioteca guardada…');
    expect(addButton().disabled).toBe(true);
    expect(volume().disabled).toBe(true);
    expect(muteButton().disabled).toBe(true);
    await act(async () => {
      storage.releaseRead();
      await flush();
    });
    expect(addButton().disabled).toBe(false);
    expect(volume().disabled).toBe(false);
  });

  it('restaura archivos, ids, orden, selección y preferencias, en pausa y sin reproducir (Strict Mode)', async () => {
    const storage = new FakeLibraryStorage();
    seed(storage, [
      { id: 'a', title: 'Uno' },
      { id: 'b', title: 'Repetido' },
      { id: 'c', title: 'Repetido' },
    ], { selectedId: 'b', volume: 0.35, muted: true });
    const ctx = setup(storage);
    await waitFor(() => expect(rows().map((r) => r.id)).toEqual(['a', 'b', 'c']));
    expect(rows().find((r) => r.current)?.id).toBe('b');
    // Títulos repetidos con ids distintos.
    expect(screen.getAllByRole('button', { name: /^\d\. Repetido,/ })).toHaveLength(2);
    expect(storage.reads).toBe(1); // Strict Mode no restaura dos veces
    expect(persistenceText()).toBe('Biblioteca restaurada de este navegador');
    expect(volume().value).toBe('0.35');
    expect(muteButton().getAttribute('aria-pressed')).toBe('true');

    // La selección queda cargada en pausa desde el inicio; nada llama a play().
    expect(ctx.fake.elements).toHaveLength(1);
    expect(ctx.fake.media().playCalls).toBe(0);
    expect(ctx.fake.media().currentTime).toBe(0);
    expect(ctx.fake.media().volume).toBe(0.35);
    expect(ctx.fake.media().muted).toBe(true);
    expect(ctx.fake.created).toHaveLength(1); // una sola URL: la de la canción seleccionada
    await act(async () => ctx.fake.media().loadMeta(29.5));
    expect(screen.getByTestId('playback-status').textContent).toBe('En pausa');
    expect(storage.commits).toHaveLength(0); // restaurar no reescribe nada

    // Reproducir sigue funcionando con el archivo restaurado.
    await ctx.user.click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(ctx.fake.media().playCalls).toBe(1);
  });

  it('datos dañados: muestra solo las válidas e informa qué no se recuperó', async () => {
    const storage = new FakeLibraryStorage();
    seed(storage, [{ id: 'a', title: 'Buena' }]);
    storage.songs.set('rota', { id: 'rota', title: 'Rota', file: new Blob([]) });
    storage.meta.set('library', { ...storage.library, order: ['a', 'rota'] });
    setup(storage);
    await waitFor(() => expect(rows().map((r) => r.id)).toEqual(['a']));
    const report = screen.getByTestId('restore-report');
    expect(report.textContent).toContain('«Rota»: falta el archivo de audio o está vacío.');
    await saved(); // el registro reparado se guarda, con copia del original
    expect(storage.songs.has('rota')).toBe(true);
  });
});

describe('guardado automático', () => {
  it('importar al final, al inicio y en posición; seleccionar; volumen y silencio', async () => {
    const ctx = setup();
    await waitFor(() => expect(addButton().disabled).toBe(false));
    await importSong(ctx, 'uno.mp3');
    await saved();
    await importSong(ctx, 'dos.mp3', 'Al inicio');
    await importSong(ctx, 'tres.mp3', 'En una posición', '2');
    await saved();
    expect(ctx.storage.order).toEqual(['nuevo-2', 'nuevo-3', 'nuevo-1']);
    expect(rows().map((r) => r.id)).toEqual(ctx.storage.order);

    await ctx.user.click(screen.getByRole('button', { name: /^1\. dos/ }));
    await saved();
    expect(ctx.storage.library).toMatchObject({ selectedId: 'nuevo-2' });

    await ctx.user.click(muteButton());
    await saved();
    expect(ctx.storage.library).toMatchObject({ muted: true });
    // Cada MP3 se escribió una vez; los cambios de selección o preferencias no lo reescriben.
    expect(ctx.storage.commits.flatMap((c) => c.put.map((r) => r.id)).sort()).toEqual(['nuevo-1', 'nuevo-2', 'nuevo-3']);
  });

  it('el avance automático guarda la nueva selección', async () => {
    const storage = new FakeLibraryStorage();
    seed(storage, [{ id: 'a', title: 'Uno' }, { id: 'b', title: 'Dos' }]);
    const ctx = setup(storage);
    await waitFor(() => expect(rows()).toHaveLength(2));
    await act(async () => ctx.fake.media().loadMeta(30));
    await ctx.user.click(screen.getByRole('button', { name: 'Reproducir' }));
    await act(async () => {
      ctx.fake.media().resolvePlay();
      await flush();
    });
    await act(async () => ctx.fake.media().finish());
    await saved();
    expect(storage.library).toMatchObject({ selectedId: 'b' });
  });

  it('eliminar se persiste sin archivo huérfano; eliminar la última deja la biblioteca vacía', async () => {
    const storage = new FakeLibraryStorage();
    seed(storage, [{ id: 'a', title: 'Uno' }, { id: 'b', title: 'Dos' }]);
    const ctx = setup(storage);
    await waitFor(() => expect(rows()).toHaveLength(2));
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. Uno' }));
    await saved();
    expect([...storage.songs.keys()]).toEqual(['b']);
    expect(storage.order).toEqual(['b']);
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. Dos' }));
    await saved();
    expect(storage.songs.size).toBe(0);
    expect(storage.library).toMatchObject({ order: [], selectedId: null });
  });

  it('fallo al guardar: error visible, la sesión sigue y "Reintentar" guarda el estado vigente', async () => {
    const ctx = setup();
    await waitFor(() => expect(addButton().disabled).toBe(false));
    ctx.storage.failNext('quota');
    await importSong(ctx, 'uno.mp3');
    await waitFor(() => expect(persistenceText()).toMatch(/No queda espacio/));
    expect(ctx.storage.songs.size).toBe(0);
    expect(rows()).toHaveLength(1); // la canción sigue en la sesión
    await ctx.user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await saved();
    expect(ctx.storage.order).toEqual(['nuevo-1']);
  });

  it('desmontar cierra la conexión; una restauración que termina después no se aplica', async () => {
    const storage = new FakeLibraryStorage();
    storage.holdRead = true;
    seed(storage, [{ id: 'a', title: 'Uno' }]);
    const ctx = setup(storage);
    ctx.unmount();
    expect(storage.closes).toBeGreaterThan(0);
    await act(async () => {
      storage.releaseRead();
      await flush();
    });
    expect(storage.commits).toHaveLength(0);
    expect(ctx.fake.elements).toHaveLength(0);
  });
});
