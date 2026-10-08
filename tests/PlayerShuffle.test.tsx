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
 * Aleatorio (fase 5) en el reproductor completo, en Strict Mode, con APIs
 * SIMULADAS (elemento de audio y almacenamiento en memoria) y un generador
 * aleatorio fijado por la prueba. Sin sonido: el navegador real se usó aparte.
 */

afterEach(cleanup);

function seed(storage: FakeLibraryStorage, ids: string[], extra: Record<string, unknown> = {}) {
  ids.forEach((id, i) => {
    const song = createSong({ title: `Canción ${id.toUpperCase()}`, durationSeconds: 30 }, () => id);
    const file = new File([new Uint8Array(16).fill(i + 1)], `${id}.mp3`, { type: 'audio/mpeg' });
    storage.songs.set(id, { ...toStoredSong(song, { file, fileName: file.name, durationSeconds: 29 }, i) });
  });
  storage.meta.set('library', {
    key: 'library',
    schemaVersion: SCHEMA_VERSION,
    order: ids,
    selectedId: ids[0] ?? null,
    volume: 1,
    muted: false,
    revision: 1,
    savedAt: 0,
    ...extra,
  });
}

/** Generador fijo: siempre el último candidato (≠ orden de la lista). */
const LAST = () => 0.999;

async function setup(ids = ['a', 'b', 'c', 'd'], extra: Record<string, unknown> = {}, random = LAST) {
  const storage = new FakeLibraryStorage();
  seed(storage, ids, extra);
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
        random={random}
      />
    </StrictMode>,
  );
  await waitFor(() => expect(rowIds()).toHaveLength(ids.length));
  await act(async () => fake.media().loadMeta(30));
  return { storage, fake, user, ...utils };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const rowIds = () =>
  screen
    .queryAllByRole('listitem')
    .filter((li) => li.hasAttribute('data-song-id'))
    .map((li) => li.getAttribute('data-song-id'));
const current = () =>
  screen
    .queryAllByRole('listitem')
    .find((li) => within(li).queryByRole('button', { current: true }))
    ?.getAttribute('data-song-id') ?? null;
const shuffleButton = () => screen.getByRole('button', { name: 'Aleatorio' });
const repeatButton = () => screen.getByRole('button', { name: /repetición|Repetir/ });
const next = () => screen.getByRole('button', { name: 'Siguiente' });
const prev = () => screen.getByRole('button', { name: 'Anterior' });
const status = () => screen.getByTestId('playback-status').textContent;
const playButton = () => screen.getByRole('button', { name: /^(Reproducir|Pausar)$/ });

async function play(ctx: Ctx) {
  await ctx.user.click(playButton());
  await act(async () => {
    ctx.fake.media().resolvePlay();
    await flush();
  });
}
async function confirm(ctx: Ctx) {
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
async function setRepeat(ctx: Ctx, label: string) {
  for (let i = 0; i < 3 && repeatButton().textContent !== label; i++) await ctx.user.click(repeatButton());
  expect(repeatButton().textContent).toBe(label);
}

describe('botón de aleatorio', () => {
  it('nombre accesible, aria-pressed y sin tocar la canción ni el audio', async () => {
    const ctx = await setup();
    await play(ctx);
    const media = ctx.fake.media();
    const before = { src: media.src, plays: media.playCalls, pauses: media.pauseCalls, time: media.currentTime };
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('false');
    await ctx.user.click(shuffleButton());
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('true');
    await setRepeat(ctx, 'Repetir canción');
    await ctx.user.click(shuffleButton());
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('false');
    expect(status()).toBe('Reproduciendo');
    expect(current()).toBe('a');
    expect({ src: media.src, plays: media.playCalls, pauses: media.pauseCalls, time: media.currentTime }).toEqual(before);
  });
});

describe('navegación aleatoria', () => {
  it('Siguiente elige candidatos sin repetir; el orden visual y el guardado no cambian', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    expect(prev().getAttribute('aria-disabled')).toBe('true'); // sin historial
    const visited = [current()];
    for (let i = 0; i < 3; i++) {
      await ctx.user.click(next());
      visited.push(current());
    }
    expect(visited).toEqual(['a', 'd', 'c', 'b']); // siempre el último candidato
    expect(new Set(visited).size).toBe(4);
    expect(next().getAttribute('aria-disabled')).toBe('true'); // ciclo agotado: no se renueva a mano
    await ctx.user.click(next());
    expect(current()).toBe('b');
    expect(rowIds()).toEqual(['a', 'b', 'c', 'd']);
    await waitFor(() => expect(ctx.storage.library).toMatchObject({ shuffle: true, selectedId: 'b' }));
    expect(ctx.storage.order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Anterior recorre el historial y luego Siguiente el historial adelantado', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await ctx.user.click(next()); // d
    await ctx.user.click(next()); // c
    await ctx.user.click(prev());
    expect(current()).toBe('d');
    await ctx.user.click(prev());
    expect(current()).toBe('a');
    expect(prev().getAttribute('aria-disabled')).toBe('true');
    await ctx.user.click(next());
    expect(current()).toBe('d'); // adelantado, no un candidato nuevo
    await ctx.user.click(next());
    expect(current()).toBe('c');
    await ctx.user.click(next());
    expect(current()).toBe('b'); // ahora sí el candidato restante
  });

  it('desactivar conserva la canción y vuelve a prev/next de la lista enlazada', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await ctx.user.click(next()); // d
    await ctx.user.click(shuffleButton());
    expect(current()).toBe('d');
    expect(next().getAttribute('aria-disabled')).toBe('true'); // d es el último nodo
    await ctx.user.click(prev());
    expect(current()).toBe('c');
  });

  it('clics rápidos: cada clic consume un candidato, sin dobles selecciones', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await ctx.user.tripleClick(next());
    expect(current()).toBe('b');
    expect(next().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('aleatorio al terminar (prioridad con la repetición)', () => {
  it('sin repetición: recorre los candidatos y luego queda finalizada', async () => {
    const ctx = await setup(['a', 'b', 'c']);
    await ctx.user.click(shuffleButton());
    await play(ctx);
    const order = [current()];
    for (let i = 0; i < 2; i++) {
      await finish(ctx);
      await confirm(ctx);
      order.push(current());
    }
    expect(order).toEqual(['a', 'c', 'b']);
    await finish(ctx);
    expect(status()).toBe('Finalizada');
    expect(current()).toBe('b');
  });

  it('repetir playlist: al agotar, nuevo ciclo sin repetir enseguida la última', async () => {
    const ctx = await setup(['a', 'b', 'c'], {}, () => 0); // siempre el primer candidato permitido
    await ctx.user.click(shuffleButton());
    await setRepeat(ctx, 'Repetir playlist');
    await play(ctx);
    const order = [current()];
    for (let i = 0; i < 5; i++) {
      await finish(ctx);
      await confirm(ctx);
      order.push(current());
    }
    // Ciclo 1: a, b, c. Ciclo 2 empieza evitando "c".
    expect(order.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(order[3]).not.toBe('c');
    expect([...order.slice(3)].sort()).toEqual(['a', 'b', 'c']);
    expect(rowIds()).toEqual(['a', 'b', 'c']);
  });

  it('repetir canción tiene prioridad sobre el aleatorio', async () => {
    const ctx = await setup(['a', 'b', 'c']);
    await ctx.user.click(shuffleButton());
    await setRepeat(ctx, 'Repetir canción');
    await play(ctx);
    const plays = ctx.fake.media().playCalls;
    await finish(ctx);
    expect(current()).toBe('a');
    expect(ctx.fake.media().playCalls).toBe(plays + 1);
    expect(ctx.fake.media().currentTime).toBe(0);
  });

  it('una sola canción: sin repetición termina; los dos modos de repetición la repiten', async () => {
    for (const label of ['Sin repetición', 'Repetir playlist', 'Repetir canción']) {
      const ctx = await setup(['a']);
      await ctx.user.click(shuffleButton());
      await setRepeat(ctx, label);
      await play(ctx);
      const plays = ctx.fake.media().playCalls;
      await finish(ctx);
      expect(current()).toBe('a');
      if (label === 'Sin repetición') {
        expect(status()).toBe('Finalizada');
        expect(ctx.fake.media().playCalls).toBe(plays);
      } else {
        expect(ctx.fake.media().playCalls).toBe(plays + 1);
      }
      cleanup();
    }
  });

  it('un final tardío de la fuente anterior no consume otro candidato', async () => {
    const ctx = await setup(['a', 'b', 'c']);
    await ctx.user.click(shuffleButton());
    await play(ctx);
    const stale = ctx.fake.media().snapshotListeners('ended');
    await ctx.user.click(next()); // c
    await act(async () => {
      for (const listener of stale) listener();
    });
    expect(current()).toBe('c');
    expect(next().getAttribute('aria-disabled')).toBe('false'); // "b" sigue disponible
  });
});

describe('cambios en la playlist con aleatorio', () => {
  it('selección manual y eliminación actualizan historial y candidatos', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await ctx.user.click(screen.getByRole('button', { name: /^2\. Canción B/ })); // manual
    expect(current()).toBe('b');
    await ctx.user.click(next());
    expect(current()).toBe('d'); // b ya no es candidata; último candidato restante: d
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 3. Canción C' }));
    await ctx.user.click(next());
    expect(next().getAttribute('aria-disabled')).toBe('true'); // c eliminada: no hay más
    await ctx.user.click(prev());
    expect(current()).toBe('b');
    await ctx.user.click(prev());
    expect(current()).toBe('a');
  });

  it('eliminar la actual selecciona una alternativa en pausa (comportamiento existente)', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await play(ctx);
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. Canción A' }));
    expect(current()).toBe('b');
    expect(status()).not.toBe('Reproduciendo');
    expect(prev().getAttribute('aria-disabled')).toBe('true');
  });

  it('vaciar elimina candidatos e historial y conserva la preferencia', async () => {
    const ctx = await setup();
    await ctx.user.click(shuffleButton());
    await ctx.user.click(next());
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar playlist' }));
    await ctx.user.click(screen.getByRole('button', { name: 'Vaciar' }));
    expect(rowIds()).toEqual([]);
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(ctx.storage.library).toMatchObject({ order: [], shuffle: true }));
  });
});

describe('preferencia guardada', () => {
  it('se restaura sin reproducir; datos antiguos o inválidos = desactivado', async () => {
    const on = await setup(['a', 'b'], { shuffle: true });
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('true');
    expect(on.fake.media().playCalls).toBe(0);
    expect(status()).toBe('En pausa');
    await on.user.click(next()); // el ciclo se reconstruyó desde la selección
    expect(current()).toBe('b');
    cleanup();

    await setup(['a', 'b']);
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('false');
    cleanup();

    await setup(['a', 'b'], { shuffle: 'quizás' });
    expect(shuffleButton().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('restore-report').textContent).toMatch(/aleatoria/);
  });
});
