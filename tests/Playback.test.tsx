// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReadAudioMetadata } from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Integración del reproductor con un elemento de audio SIMULADO
 * (tests/fakes/fakeMedia.ts) y un lector de metadatos simulado. No hay sonido:
 * se comprueba qué hace la interfaz con el elemento. La reproducción real se
 * verifica en el navegador (docs/progreso.md).
 */

afterEach(cleanup);

function setup({ strict = false } = {}) {
  const fake = fakePlaybackEnvironment();
  const pending: ((s: number) => Promise<void>)[] = [];
  const read: ReadAudioMetadata = () =>
    new Promise((resolve) => {
      pending.push((s) => act(async () => resolve({ durationSeconds: s })));
    });
  let n = 0;
  const user = userEvent.setup({ delay: null });
  const tree = (
    <Player generateId={() => `id-${++n}`} readMetadata={read} playbackEnvironment={fake.env} />
  );
  const utils = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { user, fake, resolveRead: (s: number) => pending[pending.length - 1]!(s), ...utils };
}
type Ctx = ReturnType<typeof setup>;

const status = () => screen.getByTestId('playback-status').textContent;
const playButton = () => screen.getByRole('button', { name: /^(Reproducir|Pausar)$/ });
const title = () =>
  within(screen.getByRole('region', { name: /canción seleccionada/i })).queryByRole('heading')
    ?.textContent ?? null;
const seek = () => screen.getByRole('slider', { name: 'Posición en la canción' }) as HTMLInputElement;
const volume = () => screen.getByRole('slider', { name: 'Volumen' }) as HTMLInputElement;
const media = (ctx: Ctx) => ctx.fake.media();

async function importSong(ctx: Ctx, name: string, seconds = 30) {
  await ctx.user.click(screen.getByRole('button', { name: 'Agregar canción' }));
  const dialog = screen.getByRole('dialog');
  await ctx.user.upload(
    within(dialog).getByLabelText('Archivo MP3'),
    new File([new Uint8Array(64)], name, { type: 'audio/mpeg' }),
  );
  await ctx.resolveRead(seconds);
  await ctx.user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
}

/** El navegador simulado termina de cargar los metadatos de la fuente actual. */
async function metadata(ctx: Ctx, seconds: number) {
  await act(async () => media(ctx).loadMeta(seconds));
}

async function confirmPlay(ctx: Ctx) {
  await act(async () => {
    media(ctx).resolvePlay();
    await flush();
  });
}

async function threeSongsPlaying() {
  const ctx = setup();
  await importSong(ctx, 'uno.mp3');
  await importSong(ctx, 'dos.mp3');
  await importSong(ctx, 'tres.mp3');
  await metadata(ctx, 30);
  await ctx.user.click(playButton());
  await confirmPlay(ctx);
  return ctx;
}

describe('primera importación y transporte', () => {
  it('la primera importación carga la canción en pausa', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    expect(title()).toBe('uno');
    expect(status()).toBe('Cargando…');
    await metadata(ctx, 7.24);
    expect(status()).toBe('En pausa');
    expect(media(ctx).playCalls).toBe(0);
    expect(screen.getByTestId('duration').textContent).toBe('0:08');
    expect(playButton().getAttribute('aria-label')).toBe('Reproducir');
  });

  it('reproducir, pausar y reanudar', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await metadata(ctx, 60);
    await ctx.user.click(playButton());
    expect(status()).toBe('Cargando…'); // aún no confirmado
    expect(playButton().getAttribute('aria-label')).toBe('Pausar');
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');

    await act(async () => media(ctx).advance(14));
    expect(screen.getByTestId('elapsed').textContent).toBe('0:14');
    await ctx.user.click(playButton());
    expect(status()).toBe('En pausa');
    expect(media(ctx).currentTime).toBe(14);
    await ctx.user.click(playButton());
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');
    expect(media(ctx).currentTime).toBe(14);
  });

  it('si el navegador bloquea play() lo explica y se puede reintentar con Reproducir', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await ctx.user.click(playButton());
    await act(async () => {
      media(ctx).rejectPlay('NotAllowedError');
      await flush();
    });
    expect(status()).toContain('Pulsa Reproducir');
    expect(playButton().getAttribute('aria-label')).toBe('Reproducir');
    await ctx.user.click(playButton());
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');
  });
});

describe('cambios de canción', () => {
  it('Siguiente mientras suena: carga la nueva desde 0 y sigue sonando', async () => {
    const ctx = await threeSongsPlaying();
    await act(async () => media(ctx).advance(10));
    await ctx.user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(title()).toBe('dos');
    expect(media(ctx).currentTime).toBe(0);
    expect(media(ctx).src).toContain('dos.mp3');
    expect(playButton().getAttribute('aria-label')).toBe('Pausar');
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');
  });

  it('cambiar de canción en pausa la deja en pausa', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await importSong(ctx, 'dos.mp3');
    await ctx.user.click(screen.getByRole('button', { name: /^2\. dos/ }));
    await metadata(ctx, 20);
    expect(title()).toBe('dos');
    expect(status()).toBe('En pausa');
    expect(media(ctx).playCalls).toBe(0);
  });

  it('seleccionar la misma canción no reinicia su tiempo', async () => {
    const ctx = await threeSongsPlaying();
    await act(async () => media(ctx).advance(9));
    const srcBefore = media(ctx).src;
    await ctx.user.click(screen.getByRole('button', { name: /^1\. uno/ }));
    expect(media(ctx).src).toBe(srcBefore);
    expect(media(ctx).currentTime).toBe(9);
  });

  it('final automático: avanza una vez al siguiente y lo reproduce; al final queda "Finalizada"', async () => {
    const ctx = await threeSongsPlaying();
    await act(async () => media(ctx).finish());
    expect(title()).toBe('dos');
    await metadata(ctx, 30);
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');

    await act(async () => media(ctx).finish());
    expect(title()).toBe('tres');
    await metadata(ctx, 30);
    await confirmPlay(ctx);
    await act(async () => media(ctx).finish());
    expect(title()).toBe('tres'); // no hay siguiente: conserva la selección
    expect(status()).toBe('Finalizada');

    await ctx.user.click(playButton()); // reproducir de nuevo empieza en 0
    expect(media(ctx).currentTime).toBe(0);
    await confirmPlay(ctx);
    expect(status()).toBe('Reproduciendo');
  });

  it('eliminar la actual mientras suena: se detiene y la nueva selección queda en pausa', async () => {
    const ctx = await threeSongsPlaying();
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. uno' }));
    expect(media(ctx).paused).toBe(true);
    expect(title()).toBe('dos');
    await metadata(ctx, 30);
    expect(status()).toBe('En pausa');
    expect(media(ctx).src).toContain('dos.mp3');
  });

  it('eliminar otra canción o importar no interrumpe el sonido ni su tiempo', async () => {
    const ctx = await threeSongsPlaying();
    await act(async () => media(ctx).advance(11));
    const pauses = media(ctx).pauseCalls;
    const src = media(ctx).src;
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 3. tres' }));
    await importSong(ctx, 'cuatro.mp3');
    expect(media(ctx).pauseCalls).toBe(pauses);
    expect(media(ctx).src).toBe(src);
    expect(media(ctx).currentTime).toBe(11);
    expect(status()).toBe('Reproduciendo');
  });

  it('abrir y cancelar el diálogo no pausa ni reinicia', async () => {
    const ctx = await threeSongsPlaying();
    await act(async () => media(ctx).advance(5));
    const pauses = media(ctx).pauseCalls;
    await ctx.user.click(screen.getByRole('button', { name: 'Agregar canción' }));
    await ctx.user.keyboard('{Escape}');
    expect(media(ctx).pauseCalls).toBe(pauses);
    expect(media(ctx).currentTime).toBe(5);
    expect(status()).toBe('Reproduciendo');
  });

  it('eliminar la única canción detiene, descarga y limpia los controles', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await metadata(ctx, 30);
    await ctx.user.click(playButton());
    await confirmPlay(ctx);
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. uno' }));
    expect(media(ctx).paused).toBe(true);
    expect(media(ctx).src).toBe('');
    expect(ctx.fake.revoked).toEqual(ctx.fake.created);
    expect(status()).toBe('Sin canción');
    expect((playButton() as HTMLButtonElement).disabled).toBe(true);
    expect(seek().disabled).toBe(true);
    expect(screen.getByTestId('elapsed').textContent).toBe('0:00');
  });
});

describe('barra de progreso, volumen y silencio', () => {
  it('la barra cambia currentTime con valores válidos y conserva la reproducción', async () => {
    const ctx = await threeSongsPlaying();
    fireEvent.change(seek(), { target: { value: '12' } });
    expect(media(ctx).currentTime).toBe(12);
    expect(status()).toBe('Reproduciendo');
    expect(seek().getAttribute('aria-valuetext')).toBe('0:12 de 0:30');
  });

  it('teclado: flechas ±5 s, Inicio y Fin', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await metadata(ctx, 30);
    seek().focus();
    await ctx.user.keyboard('{ArrowRight}{ArrowRight}');
    expect(media(ctx).currentTime).toBe(10);
    await ctx.user.keyboard('{ArrowLeft}');
    expect(media(ctx).currentTime).toBe(5);
    await ctx.user.keyboard('{End}');
    expect(media(ctx).currentTime).toBe(30);
    await ctx.user.keyboard('{Home}');
    expect(media(ctx).currentTime).toBe(0);
    expect(status()).toBe('En pausa');
  });

  it('volumen y silencio modifican el elemento; silenciar conserva el volumen', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    fireEvent.change(volume(), { target: { value: '0.35' } });
    expect(media(ctx).volume).toBe(0.35);
    const mute = screen.getByRole('button', { name: 'Silenciar' });
    await ctx.user.click(mute);
    expect(media(ctx).muted).toBe(true);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(media(ctx).volume).toBe(0.35);
    expect(volume().getAttribute('aria-valuetext')).toBe('35 %, silenciado');
    await ctx.user.click(mute);
    expect(media(ctx).muted).toBe(false);
  });
});

describe('ciclo de vida', () => {
  it('Strict Mode: un solo elemento, sin listeners duplicados ni play() repetidos', async () => {
    const ctx = setup({ strict: true });
    await importSong(ctx, 'uno.mp3');
    await metadata(ctx, 30);
    await ctx.user.click(playButton());
    await confirmPlay(ctx);
    expect(ctx.fake.elements).toHaveLength(1);
    for (const type of ['timeupdate', 'ended', 'error', 'playing', 'pause']) {
      expect(media(ctx).listenerCount(type)).toBe(1);
    }
    expect(media(ctx).playCalls).toBe(1);
    expect(status()).toBe('Reproduciendo');
  });

  it('al desmontar se detiene el audio, se revoca la URL y se quitan los listeners', async () => {
    const ctx = await threeSongsPlaying();
    ctx.unmount();
    expect(media(ctx).paused).toBe(true);
    expect(media(ctx).src).toBe('');
    expect(media(ctx).listenerCount()).toBe(0);
    expect(ctx.fake.revoked).toEqual(ctx.fake.created);
  });

  it('cambiar de canción no elimina archivos del registro: volver a una canción la recarga', async () => {
    const ctx = await threeSongsPlaying();
    await ctx.user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await ctx.user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(title()).toBe('uno');
    expect(media(ctx).src).toContain('uno.mp3');
    expect(status()).not.toContain('Error');
  });
});
