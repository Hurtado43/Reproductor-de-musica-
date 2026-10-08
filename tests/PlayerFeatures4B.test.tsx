// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSong } from '../src/domain';
import type { ReadAudioMetadata } from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';
import { SCHEMA_VERSION, toStoredSong } from '../src/features/player/persistence/librarySchema';
import { FakeLibraryStorage } from './fakes/fakeLibraryStorage';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Funciones de la fase 4B con el reproductor completo, en Strict Mode y con
 * APIs SIMULADAS: elemento de audio (tests/fakes/fakeMedia.ts), almacenamiento
 * en memoria en lugar de IndexedDB (tests/fakes/fakeLibraryStorage.ts) y, en
 * las pruebas de la barra, requestAnimationFrame manual. Sin sonido ni WebGL:
 * lo real se verificó en el navegador (docs/progreso.md).
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

interface SeedSong {
  id: string;
  title: string;
  artist?: string | null;
}

function seed(storage: FakeLibraryStorage, songs: SeedSong[], extra: Record<string, unknown> = {}) {
  songs.forEach(({ id, title, artist = null }, i) => {
    const song = createSong({ title, artist, durationSeconds: 30 }, () => id);
    const file = new File([new Uint8Array(32).fill(i + 1)], `${id}.mp3`, { type: 'audio/mpeg' });
    storage.songs.set(id, { ...toStoredSong(song, { file, fileName: file.name, durationSeconds: 29.5 }, i) });
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

const FOUR: SeedSong[] = [
  { id: 'a', title: 'Canción de cuna', artist: 'José Álvarez' },
  { id: 'b', title: 'Rock nocturno', artist: 'Ana' },
  { id: 'c', title: 'Balada', artist: null },
  { id: 'd', title: 'Adiós', artist: 'Luis' },
];

async function setup(songs: SeedSong[] = FOUR, extra: Record<string, unknown> = {}) {
  const storage = new FakeLibraryStorage();
  if (songs.length > 0 || Object.keys(extra).length > 0) seed(storage, songs, extra);
  const fake = fakePlaybackEnvironment();
  const read: ReadAudioMetadata = () => new Promise(() => {});
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <StrictMode>
      <Player
        readMetadata={read}
        playbackEnvironment={fake.env}
        libraryStorage={storage}
        persistenceOptions={{ preferenceDelayMs: 0 }}
      />
    </StrictMode>,
  );
  if (songs.length > 0) {
    await waitFor(() => expect(rows()).toHaveLength(songs.length));
    await act(async () => fake.media().loadMeta(30));
  } else {
    await waitFor(() =>
      expect(screen.getByTestId('persistence-status').textContent).not.toMatch(/Restaurando/),
    );
  }
  return { storage, fake, user, ...utils };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const rows = () => screen.queryAllByRole('listitem').filter((li) => li.hasAttribute('data-song-id'));
const rowIds = () => rows().map((li) => li.getAttribute('data-song-id'));
const currentRowId = () =>
  rows()
    .find((li) => within(li).queryByRole('button', { current: true }))
    ?.getAttribute('data-song-id') ?? null;
const search = () => screen.getByRole('searchbox', { name: 'Buscar canción' }) as HTMLInputElement;
const status = () => screen.getByTestId('playback-status').textContent;
const title = () =>
  within(screen.getByRole('region', { name: /canción seleccionada/i })).queryByRole('heading')
    ?.textContent ?? null;
const playButton = () => screen.getByRole('button', { name: /^(Reproducir|Pausar)$/ });
const repeatButton = () => screen.getByRole('button', { name: /repetición|Repetir/ });
const savedText = () => screen.getByTestId('persistence-status').textContent;

async function play(ctx: Ctx) {
  await ctx.user.click(playButton());
  await act(async () => {
    ctx.fake.media().resolvePlay();
    await flush();
  });
}

async function finish(ctx: Ctx) {
  await act(async () => {
    ctx.fake.media().finish();
    await flush();
  });
}

async function setRepeat(ctx: Ctx, label: 'Sin repetición' | 'Repetir playlist' | 'Repetir canción') {
  for (let i = 0; i < 3 && repeatButton().textContent !== label; i++) await ctx.user.click(repeatButton());
  expect(repeatButton().textContent).toBe(label);
}

describe('búsqueda', () => {
  it('filtra por título y artista ignorando mayúsculas y acentos, con posiciones reales', async () => {
    const ctx = await setup();
    await ctx.user.type(search(), 'CANCION');
    expect(rowIds()).toEqual(['a']);
    await ctx.user.clear(search());
    await ctx.user.type(search(), 'alvarez');
    expect(rowIds()).toEqual(['a']);
    await ctx.user.clear(search());
    await ctx.user.type(search(), 'adiós');
    expect(rowIds()).toEqual(['d']);
    // La posición mostrada es la de la playlist completa.
    expect(within(rows()[0]!).getByRole('button', { name: /^4\. Adiós/ })).toBeTruthy();
    expect(screen.getByTestId('search-status').textContent).toMatch(/^1 de 4 canciones/);
  });

  it('distingue "sin coincidencias" de "playlist vacía" y se limpia con un botón accesible', async () => {
    const ctx = await setup();
    await ctx.user.type(search(), 'zzz');
    expect(screen.getByTestId('no-results').textContent).toContain('Ninguna canción coincide con «zzz»');
    expect(screen.queryByText('La playlist está vacía.')).toBeNull();
    await ctx.user.click(screen.getAllByRole('button', { name: 'Limpiar búsqueda' })[0]!);
    expect(search().value).toBe('');
    expect(rowIds()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ocultar la canción actual no la cambia, no interrumpe el audio ni cambia Siguiente', async () => {
    const ctx = await setup();
    await play(ctx);
    const playCalls = ctx.fake.media().playCalls;
    await ctx.user.type(search(), 'rock');
    expect(rowIds()).toEqual(['b']);
    expect(title()).toBe('Canción de cuna'); // sigue seleccionada
    expect(status()).toBe('Reproduciendo');
    expect(ctx.fake.media().playCalls).toBe(playCalls);
    expect(screen.getByTestId('search-status').textContent).toMatch(/la canción seleccionada no coincide/);
    // Siguiente usa la lista enlazada completa, no la filtrada.
    await ctx.user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(title()).toBe('Rock nocturno');
    // El filtro no se guarda como orden.
    await waitFor(() => expect(savedText()).toBe('Guardado en este navegador'));
    expect(ctx.storage.order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('seleccionar y eliminar un resultado usan su id, no el índice filtrado', async () => {
    const ctx = await setup();
    await ctx.user.type(search(), 'balada');
    await ctx.user.click(screen.getByRole('button', { name: /^3\. Balada/ }));
    expect(currentRowId()).toBe('c');
    await ctx.user.clear(search());
    await ctx.user.type(search(), 'luis');
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 4. Adiós' }));
    await waitFor(() => expect(ctx.storage.order).toEqual(['a', 'b', 'c']));
    await ctx.user.clear(search());
    expect(rowIds()).toEqual(['a', 'b', 'c']);
    expect(currentRowId()).toBe('c');
  });
});

describe('repetición', () => {
  it('desactivada: avanza en orden y en la última queda finalizada', async () => {
    const ctx = await setup(FOUR.slice(0, 2));
    await play(ctx);
    await finish(ctx);
    expect(title()).toBe('Rock nocturno');
    await act(async () => {
      ctx.fake.media().resolvePlay();
      await flush();
    });
    await finish(ctx);
    expect(title()).toBe('Rock nocturno');
    expect(status()).toBe('Finalizada');
  });

  it('repetir playlist: desde la última vuelve a la primera y la reproduce', async () => {
    const ctx = await setup(FOUR.slice(0, 2), { selectedId: 'b' });
    await setRepeat(ctx, 'Repetir playlist');
    await play(ctx);
    const before = ctx.fake.media().playCalls;
    await finish(ctx);
    expect(title()).toBe('Canción de cuna');
    expect(ctx.fake.media().playCalls).toBe(before + 1);
  });

  it('repetir canción: reinicia la actual desde 0; Siguiente sigue funcionando', async () => {
    const ctx = await setup(FOUR.slice(0, 2));
    await setRepeat(ctx, 'Repetir canción');
    await play(ctx);
    await act(async () => ctx.fake.media().advance(12));
    const before = ctx.fake.media().playCalls;
    await finish(ctx);
    expect(title()).toBe('Canción de cuna');
    expect(ctx.fake.media().playCalls).toBe(before + 1);
    expect(ctx.fake.media().currentTime).toBe(0);
    await ctx.user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(title()).toBe('Rock nocturno');
  });

  it('con una sola canción, los dos modos de repetición la vuelven a reproducir', async () => {
    for (const label of ['Repetir playlist', 'Repetir canción'] as const) {
      const ctx = await setup(FOUR.slice(0, 1));
      await setRepeat(ctx, label);
      await play(ctx);
      const before = ctx.fake.media().playCalls;
      await finish(ctx);
      expect(ctx.fake.media().playCalls).toBe(before + 1);
      expect(ctx.fake.media().currentTime).toBe(0);
      cleanup();
    }
  });

  it('el modo vigente al terminar es el que decide', async () => {
    const ctx = await setup(FOUR.slice(0, 2));
    await setRepeat(ctx, 'Repetir canción');
    await play(ctx);
    await setRepeat(ctx, 'Sin repetición'); // cambia justo antes de terminar
    await finish(ctx);
    expect(title()).toBe('Rock nocturno');
  });

  it('final y pausa: una reproducción pendiente de la repetición no suena tras pausar', async () => {
    const ctx = await setup(FOUR.slice(0, 1));
    await setRepeat(ctx, 'Repetir canción');
    await play(ctx);
    await finish(ctx); // play() de la repetición queda pendiente
    await ctx.user.click(playButton()); // Pausar
    await act(async () => {
      ctx.fake.media().resolvePlay();
      await flush();
    });
    expect(status()).toBe('En pausa');
  });

  it('final tardío de una fuente anterior tras navegar o eliminar: no avanza dos veces', async () => {
    const ctx = await setup(FOUR.slice(0, 3));
    await play(ctx);
    const staleEnded = ctx.fake.media().snapshotListeners('ended');
    await ctx.user.click(screen.getByRole('button', { name: 'Siguiente' })); // ahora "b"
    await act(async () => {
      for (const listener of staleEnded) listener();
    });
    expect(title()).toBe('Rock nocturno');

    const staleEnded2 = ctx.fake.media().snapshotListeners('ended');
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 2. Rock nocturno' }));
    await act(async () => {
      for (const listener of staleEnded2) listener();
    });
    expect(title()).toBe('Balada');
    expect(status()).not.toBe('Reproduciendo');
  });

  it('se guarda como preferencia y se restaura sin reproducir; datos antiguos = sin repetición', async () => {
    const ctx = await setup(FOUR.slice(0, 2));
    expect(repeatButton().textContent).toBe('Sin repetición');
    await setRepeat(ctx, 'Repetir playlist');
    await waitFor(() => expect(ctx.storage.library).toMatchObject({ repeatMode: 'all' }));
    cleanup();

    const restored = await setup(FOUR.slice(0, 2), { repeatMode: 'one' });
    expect(repeatButton().textContent).toBe('Repetir canción');
    expect(restored.fake.media().playCalls).toBe(0);
    expect(status()).toBe('En pausa');
    cleanup();

    await setup(FOUR.slice(0, 2), { repeatMode: 'infinito' });
    expect(repeatButton().textContent).toBe('Sin repetición');
    expect(screen.getByTestId('restore-report').textContent).toMatch(/modo de repetición/);
  });
});

describe('vaciar la playlist', () => {
  it('cancelar no cambia nada ni interrumpe la reproducción; Escape devuelve el foco', async () => {
    const ctx = await setup();
    await play(ctx);
    const opener = screen.getByRole('button', { name: 'Vaciar playlist' });
    await ctx.user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: '¿Vaciar la playlist?' });
    expect(dialog.textContent).toContain('Se quitarán 4 canciones');
    expect(dialog.textContent).toContain('Los archivos originales de tu dispositivo no se eliminan');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await ctx.user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(rowIds()).toEqual(['a', 'b', 'c', 'd']);
    expect(status()).toBe('Reproduciendo');
    expect(document.activeElement).toBe(opener);

    await ctx.user.click(opener);
    await ctx.user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(status()).toBe('Reproduciendo');
  });

  it('confirmar detiene el audio, libera la URL, vacía todo, guarda y conserva las preferencias', async () => {
    const ctx = await setup(FOUR, { volume: 0.4, muted: true, repeatMode: 'all' });
    await play(ctx);
    const media = ctx.fake.media();
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar playlist' }));
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar' }));
    expect(media.paused).toBe(true);
    expect(media.src).toBe('');
    expect(ctx.fake.revoked).toEqual(ctx.fake.created);
    expect(rowIds()).toEqual([]);
    expect(screen.getByText('La playlist está vacía.')).toBeTruthy();
    expect(status()).toBe('Sin canción');
    await waitFor(() => expect(savedText()).toBe('Guardado en este navegador'));
    expect(ctx.storage.songs.size).toBe(0);
    expect(ctx.storage.library).toMatchObject({ order: [], selectedId: null, volume: 0.4, muted: true, repeatMode: 'all' });
    expect(repeatButton().textContent).toBe('Repetir playlist');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Agregar canción' }));
  });

  it('invalida operaciones pendientes: un play() anterior no suena después de vaciar', async () => {
    const ctx = await setup();
    await ctx.user.click(playButton()); // play() pendiente
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar playlist' }));
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar' }));
    await act(async () => {
      ctx.fake.media().resolvePlay();
      await flush();
    });
    expect(status()).toBe('Sin canción');
  });

  it('si falla el guardado del vaciado no dice "Guardado" y Reintentar guarda el estado vigente', async () => {
    const ctx = await setup();
    ctx.storage.failNext('quota');
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar playlist' }));
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar' }));
    await waitFor(() => expect(savedText()).toMatch(/No queda espacio/));
    expect(ctx.storage.songs.size).toBe(4); // nada parcial
    await ctx.user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(savedText()).toBe('Guardado en este navegador'));
    expect(ctx.storage.songs.size).toBe(0);
    expect(ctx.storage.order).toEqual([]);
  });
});

describe('progreso fluido', () => {
  function manualFrames() {
    const frames = new Map<number, () => void>();
    let next = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frames.set(++next, cb);
      return next;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    return {
      frames,
      run: () =>
        act(() => {
          const callbacks = [...frames.values()];
          frames.clear();
          for (const cb of callbacks) cb();
        }),
    };
  }
  const seek = () => screen.getByRole('slider', { name: 'Posición en la canción' }) as HTMLInputElement;

  it('mientras suena lee currentTime del elemento en cada fotograma, sin timeupdate', async () => {
    const raf = manualFrames();
    const ctx = await setup(FOUR.slice(0, 1));
    await play(ctx);
    ctx.fake.media().currentTime = 7.5; // el elemento avanza; aún sin `timeupdate`
    raf.run();
    expect(seek().value).toBe('7.5');
    expect(screen.getByTestId('elapsed').textContent).toBe('0:07');
    expect(seek().getAttribute('aria-valuetext')).toBe('0:07 de 0:30');
    expect(raf.frames.size).toBe(1); // un solo bucle

    // Al pausar se cancela.
    await ctx.user.click(playButton());
    expect(raf.frames.size).toBe(0);
  });

  it('mientras el usuario arrastra, las lecturas automáticas no mueven la barra', async () => {
    const raf = manualFrames();
    const ctx = await setup(FOUR.slice(0, 1));
    await play(ctx);
    fireEvent.pointerDown(seek());
    fireEvent.change(seek(), { target: { value: '20' } });
    expect(ctx.fake.media().currentTime).toBe(20);
    ctx.fake.media().currentTime = 3; // lectura distinta durante el arrastre
    raf.run();
    expect(seek().value).toBe('20');
    fireEvent.pointerUp(seek());
    raf.run();
    expect(seek().value).toBe('3');
    expect(status()).toBe('Reproduciendo'); // sigue sonando tras buscar
  });
});
