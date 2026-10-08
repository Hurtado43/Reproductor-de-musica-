// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadAudioMetadata } from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';
import type { OrbCanvasProps } from '../src/features/player/visualizer/OrbCanvas';
import { fakeAudioContextFactory, toneSignal } from './fakes/fakeAudioContext';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Reproductor completo con Web Audio SIMULADO: elemento de audio, AudioContext,
 * nodo fuente y AnalyserNode simulados (tests/fakes), requestAnimationFrame
 * manual y una escena 3D simulada que guarda sus props. No hay sonido ni WebGL:
 * se comprueba la propiedad de los recursos y el flujo de datos hacia la esfera.
 */

const webgl = vi.hoisted(() => ({ available: true }));
vi.mock('../src/features/player/visualizer/webgl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/player/visualizer/webgl')>();
  return { ...actual, isWebGLAvailable: () => webgl.available };
});

const scene = vi.hoisted(() => ({ mounts: 0, unmounts: 0, props: [] as OrbCanvasProps[] }));
vi.mock('../src/features/player/visualizer/OrbCanvas', () => ({
  default: function FakeOrbCanvas(props: OrbCanvasProps) {
    scene.props.push(props);
    useEffect(() => {
      scene.mounts += 1;
      props.onReady();
      return () => {
        scene.unmounts += 1;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="fake-orb-canvas" />;
  },
}));

beforeEach(() => {
  webgl.available = true;
  Object.assign(scene, { mounts: 0, unmounts: 0, props: [] });
});
afterEach(cleanup);

function setup({ strict = true } = {}) {
  const contexts = fakeAudioContextFactory();
  const frames = new Map<number, () => void>();
  let frameId = 0;
  const fake = fakePlaybackEnvironment({ createAudioContext: contexts.create });
  const env = {
    ...fake.env,
    requestAnimationFrame: (cb: () => void) => {
      frames.set(++frameId, cb);
      return frameId;
    },
    cancelAnimationFrame: (id: unknown) => {
      frames.delete(id as number);
    },
  };
  const pending: ((s: number) => Promise<void>)[] = [];
  const read: ReadAudioMetadata = () =>
    new Promise((resolve) => {
      pending.push((s) => act(async () => resolve({ durationSeconds: s })));
    });
  let n = 0;
  const user = userEvent.setup({ delay: null });
  const tree = <Player generateId={() => `id-${++n}`} readMetadata={read} playbackEnvironment={env} />;
  const utils = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  const runFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const cb of callbacks) cb();
  };
  return { user, contexts, fake, frames, runFrame, resolveRead: () => pending[pending.length - 1]!(30), ...utils };
}
type Ctx = ReturnType<typeof setup>;

async function importSong(ctx: Ctx, name: string) {
  await ctx.user.click(screen.getByRole('button', { name: 'Agregar canción' }));
  const dialog = screen.getByRole('dialog');
  await ctx.user.upload(
    within(dialog).getByLabelText('Archivo MP3'),
    new File([new Uint8Array(64)], name, { type: 'audio/mpeg' }),
  );
  await ctx.resolveRead();
  await ctx.user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
}

const playButton = () => screen.getByRole('button', { name: /^(Reproducir|Pausar)$/ });
const status = () => screen.getByTestId('playback-status').textContent;

async function confirm(ctx: Ctx, { resume = false } = {}) {
  await act(async () => {
    if (resume) ctx.contexts.last().resolveResume();
    await flush();
    ctx.fake.media().resolvePlay();
    await flush();
  });
}

describe('Web Audio en el reproductor (simulado)', () => {
  it('Strict Mode: un elemento, un contexto y una fuente; la escena recibe siempre la misma entrada', async () => {
    const ctx = setup();
    // Strict Mode monta, limpia y vuelve a montar los efectos: queda una escena viva.
    await waitFor(() => expect(scene.mounts - scene.unmounts).toBe(1));
    const mountsBefore = scene.mounts;
    await importSong(ctx, 'uno.mp3');
    await importSong(ctx, 'dos.mp3');
    expect(ctx.contexts.contexts).toHaveLength(0); // nada sin un gesto de reproducir

    await ctx.user.click(playButton());
    expect(status()).toBe('Cargando…');
    await confirm(ctx, { resume: true });
    expect(status()).toBe('Reproduciendo');

    await ctx.user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await confirm(ctx);
    await ctx.user.click(screen.getByRole('button', { name: /Anterior/ }));
    await confirm(ctx);
    await ctx.user.click(playButton()); // pausa
    await ctx.user.click(playButton()); // reanuda
    await confirm(ctx);

    expect(ctx.fake.elements).toHaveLength(1);
    expect(ctx.contexts.contexts).toHaveLength(1);
    expect(ctx.contexts.last().sourceCalls).toBe(1);
    expect(ctx.contexts.last().edges).toEqual(['source->analyser', 'analyser->destination']);
    expect(scene.mounts).toBe(mountsBefore); // cambiar de canción no recrea la escena
    expect(scene.mounts - scene.unmounts).toBe(1);
    const inputs = new Set(scene.props.map((p) => p.audio));
    expect(inputs.size).toBe(1);
  });

  it('los niveles reales llegan a la esfera mientras suena y vuelven a 0 al pausar', async () => {
    const ctx = setup();
    await waitFor(() => expect(scene.mounts - scene.unmounts).toBe(1));
    await importSong(ctx, 'uno.mp3');
    await ctx.user.click(playButton());
    await confirm(ctx, { resume: true });
    const audio = scene.props[scene.props.length - 1]!.audio;
    const context = ctx.contexts.last();
    context.signal = toneSignal(80, 0.3);
    context.advance(0.1);
    act(() => ctx.runFrame());
    expect(audio.current.bass).toBeGreaterThan(0.5);
    expect(ctx.frames.size).toBe(1); // un solo bucle, también con Strict Mode

    await ctx.user.click(playButton()); // pausa
    expect(audio.current).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    expect(ctx.frames.size).toBe(0);
  });

  it('eliminar la actual mientras resume() está pendiente no reproduce nada', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await importSong(ctx, 'dos.mp3');
    await ctx.user.click(playButton());
    await ctx.user.click(screen.getByRole('button', { name: /^Eliminar 1\./ }));
    await act(async () => {
      ctx.contexts.last().resolveResume();
      await flush();
    });
    expect(ctx.fake.media().playCalls).toBe(0);
    expect(status()).not.toBe('Reproduciendo');
  });

  it('desmontar libera el elemento, desconecta los nodos, cierra el contexto y detiene el bucle', async () => {
    const ctx = setup();
    await importSong(ctx, 'uno.mp3');
    await ctx.user.click(playButton());
    await confirm(ctx, { resume: true });
    const context = ctx.contexts.last();
    expect(ctx.frames.size).toBe(1);
    ctx.unmount();
    expect(context.state).toBe('closed');
    expect(context.closeCalls).toBe(1);
    expect(context.edges).toEqual([]);
    expect(ctx.fake.media().src).toBe('');
    expect(ctx.fake.revoked).toEqual(ctx.fake.created);
    expect(ctx.frames.size).toBe(0);
  });

  it('un fallo al activar la salida se muestra y Reproducir lo reintenta', async () => {
    const ctx = setup({ strict: false });
    await importSong(ctx, 'uno.mp3');
    await ctx.user.click(playButton());
    await act(async () => {
      ctx.contexts.last().rejectResume();
      await flush();
    });
    expect(status()).toMatch(/^Error: No se pudo activar la salida de audio/);
    expect(playButton().getAttribute('aria-label')).toBe('Reproducir');
    await ctx.user.click(playButton());
    await confirm(ctx, { resume: true });
    expect(status()).toBe('Reproduciendo');
  });
});
