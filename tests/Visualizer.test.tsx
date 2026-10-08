// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadAudioMetadata } from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';
import type { OrbCanvasProps } from '../src/features/player/visualizer/OrbCanvas';

/*
 * Integración de la esfera con el reproductor. Aquí NO hay render WebGL:
 * - Sin mock, jsdom no tiene WebGL (ver tests/setup/canvas.ts) → estado alternativo.
 * - Con mock, `OrbCanvas` se sustituye por un componente SIMULADO que solo
 *   cuenta montajes y guarda sus props. La escena real se verifica en el navegador.
 */

const webgl = vi.hoisted(() => ({ available: false }));
vi.mock('../src/features/player/visualizer/webgl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/player/visualizer/webgl')>();
  return { ...actual, isWebGLAvailable: () => webgl.available };
});

const scene = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  lastProps: null as OrbCanvasProps | null,
  throwOnRender: false,
  autoReady: true,
}));
vi.mock('../src/features/player/visualizer/OrbCanvas', () => ({
  default: function FakeOrbCanvas(props: OrbCanvasProps) {
    if (scene.throwOnRender) throw new Error('Error creating WebGL context');
    scene.lastProps = props;
    useEffect(() => {
      scene.mounts += 1;
      if (scene.autoReady) props.onReady();
      return () => {
        scene.unmounts += 1;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="fake-orb-canvas" />;
  },
}));

beforeEach(() => {
  webgl.available = false;
  Object.assign(scene, { mounts: 0, unmounts: 0, lastProps: null, throwOnRender: false, autoReady: true });
});
afterEach(cleanup);

function reader() {
  const pending: ((seconds: number) => Promise<void>)[] = [];
  const read: ReadAudioMetadata = () =>
    new Promise((resolve) => {
      pending.push((seconds) => act(async () => resolve({ durationSeconds: seconds })));
    });
  return { read, resolveLast: (s: number) => pending[pending.length - 1]!(s) };
}

function setup() {
  const r = reader();
  let n = 0;
  const user = userEvent.setup({ delay: null });
  const utils = render(<Player generateId={() => `id-${++n}`} readMetadata={r.read} />);
  return { user, r, ...utils };
}

const visualizer = () => screen.getByTestId('visualizer');
const currentId = () =>
  screen
    .queryAllByRole('listitem')
    .find((li) => within(li).queryByRole('button', { current: true }))
    ?.getAttribute('data-song-id') ?? null;

async function importSong(ctx: ReturnType<typeof setup>, name: string) {
  await ctx.user.click(screen.getByRole('button', { name: 'Agregar canción' }));
  const dialog = screen.getByRole('dialog');
  await ctx.user.upload(
    within(dialog).getByLabelText('Archivo MP3'),
    new File([new Uint8Array(64)], name, { type: 'audio/mpeg' }),
  );
  await ctx.r.resolveLast(30);
  await ctx.user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
}

describe('sin WebGL', () => {
  it('muestra el estado alternativo y la importación sigue funcionando', async () => {
    const ctx = setup();
    await waitFor(() => expect(visualizer().dataset.state).toBe('unsupported'));
    expect(within(visualizer()).getByRole('status').textContent).toContain(
      'La visualización 3D no está disponible en este navegador',
    );
    expect(within(visualizer()).getByText(/La playlist y la importación de canciones siguen funcionando/)).toBeTruthy();
    expect(screen.queryByTestId('fake-orb-canvas')).toBeNull();

    await importSong(ctx, 'uno.mp3');
    await importSong(ctx, 'dos.mp3');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await ctx.user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'dos' })).toBeTruthy();
  });
});

describe('con WebGL (escena simulada)', () => {
  beforeEach(() => {
    webgl.available = true;
  });

  it('el marcador "Cargando…" ocupa el espacio hasta el primer fotograma', async () => {
    scene.autoReady = false;
    setup();
    await waitFor(() => expect(screen.getByTestId('fake-orb-canvas')).toBeTruthy());
    expect(visualizer().dataset.state).toBe('loading');
    expect(within(visualizer()).getByText('Cargando visualización 3D…')).toBeTruthy();

    await act(async () => scene.lastProps!.onReady());
    expect(visualizer().dataset.state).toBe('ready');
    expect(within(visualizer()).queryByText('Cargando visualización 3D…')).toBeNull();
  });

  it('pasa la entrada de audio en silencio (energía 0) y la calidad elegida', async () => {
    setup();
    await waitFor(() => expect(scene.lastProps).not.toBeNull());
    expect(scene.lastProps!.audio.current.energy).toBe(0);
    expect(scene.lastProps!.detail).toBeGreaterThan(0);
    expect(scene.lastProps!.maxDpr).toBeLessThanOrEqual(1.5);
    expect(scene.lastProps!.reducedMotion).toBe(false);
  });

  it('importar, seleccionar, navegar, abrir el diálogo y eliminar no recrean la escena', async () => {
    const ctx = setup();
    await waitFor(() => expect(scene.mounts).toBe(1));

    await importSong(ctx, 'uno.mp3');
    await importSong(ctx, 'dos.mp3');
    await importSong(ctx, 'tres.mp3');
    await ctx.user.click(screen.getByRole('button', { name: /^2\. dos/ }));
    const selected = currentId();
    await ctx.user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await ctx.user.click(screen.getByRole('button', { name: /Anterior/ }));
    await ctx.user.click(screen.getByRole('button', { name: 'Agregar canción' }));
    await ctx.user.keyboard('{Escape}');
    await ctx.user.click(screen.getByRole('button', { name: 'Eliminar 1. uno' }));

    expect(scene.mounts).toBe(1);
    expect(scene.unmounts).toBe(0);
    expect(currentId()).toBe(selected); // la escena no altera la selección
    expect(visualizer().dataset.state).toBe('ready');
  });

  it('si la escena falla muestra el estado alternativo; Reintentar la vuelve a montar', async () => {
    scene.throwOnRender = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = setup();
    await waitFor(() => expect(visualizer().dataset.state).toBe('failed'));
    expect(within(visualizer()).getByText('No se pudo iniciar la visualización 3D.')).toBeTruthy();

    await importSong(ctx, 'sigue.mp3'); // el reproductor sigue funcionando
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    scene.throwOnRender = false;
    await ctx.user.click(within(visualizer()).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(visualizer().dataset.state).toBe('ready'));
    errors.mockRestore();
  });

  it('la pérdida del contexto WebGL muestra el estado alternativo', async () => {
    setup();
    await waitFor(() => expect(scene.lastProps).not.toBeNull());
    await act(async () => scene.lastProps!.onContextLost());
    expect(visualizer().dataset.state).toBe('failed');
    expect(within(visualizer()).getByText(/se interrumpió/)).toBeTruthy();
  });

  it('al desmontar el reproductor se desmonta la escena (libera recursos)', async () => {
    const { unmount } = setup();
    await waitFor(() => expect(scene.mounts).toBe(1));
    unmount();
    expect(scene.unmounts).toBe(1);
  });

  it('con prefers-reduced-motion la escena recibe reducedMotion', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      setup();
      await waitFor(() => expect(scene.lastProps?.reducedMotion).toBe(true));
    } finally {
      window.matchMedia = original;
    }
  });
});
