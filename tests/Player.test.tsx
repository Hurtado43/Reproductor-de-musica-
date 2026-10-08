// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AudioImportError,
  type ReadAudioMetadata,
} from '../src/features/player/audio/readAudioMetadata';
import { Player } from '../src/features/player/components/Player';

/*
 * Pruebas de interfaz con un lector de metadatos SIMULADO y controlable: cada
 * llamada queda pendiente hasta que la prueba la resuelve o la rechaza. La
 * lectura de MP3 reales se comprueba aparte en el navegador.
 */

afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;

interface ReadCall {
  file: File;
  signal: AbortSignal | undefined;
  resolve(seconds: number): Promise<void>;
  reject(error: unknown): Promise<void>;
}

function controllableReader() {
  const calls: ReadCall[] = [];
  const read: ReadAudioMetadata = (file, options) =>
    new Promise((resolve, reject) => {
      calls.push({
        file,
        signal: options?.signal,
        resolve: (seconds) => act(async () => resolve({ durationSeconds: seconds })),
        reject: (error) => act(async () => reject(error)),
      });
    });
  return { read, calls, last: () => calls[calls.length - 1]! };
}

function sequentialIds() {
  let n = 0;
  return () => `id-${++n}`;
}

function mp3(name: string, size = 2048, type = 'audio/mpeg') {
  return new File([new Uint8Array(size)], name, { type });
}

function setup(options: { generateId?: () => string; applyAccept?: boolean } = {}) {
  const reader = controllableReader();
  const user = userEvent.setup({ delay: null, applyAccept: options.applyAccept ?? true });
  const utils = render(
    <Player generateId={options.generateId ?? sequentialIds()} readMetadata={reader.read} />,
  );
  return { user, reader, ...utils };
}

const addButton = () => screen.getByRole('button', { name: 'Agregar canción' });
const dialog = () => screen.getByRole('dialog', { name: 'Agregar canción' });
const field = (label: string | RegExp) => within(dialog()).getByLabelText(label) as HTMLInputElement;
const fileInput = () => field('Archivo MP3');
const submit = () => within(dialog()).getByRole('button', { name: 'Agregar' });
const rows = () => within(screen.getByRole('list', { name: 'Canciones' })).getAllByRole('listitem');
const rowLabels = () =>
  rows().map((row) => within(row).getAllByRole('button')[0]!.getAttribute('aria-label'));
const currentRow = () => rows().find((row) => within(row).queryByRole('button', { current: true }));
const currentId = () => currentRow()?.getAttribute('data-song-id') ?? null;
const selectedTitle = () =>
  within(screen.getByRole('region', { name: /canción seleccionada/i })).queryByRole('heading')
    ?.textContent ?? null;
const stats = () => screen.getByTestId('playlist-stats').textContent;

interface ImportOptions {
  name: string;
  seconds: number;
  title?: string;
  artist?: string;
  placement?: 'first' | 'last' | 'at';
  position?: string;
}

/** Importa una canción desde la interfaz, resolviendo la lectura simulada. */
async function importSong(
  user: User,
  reader: ReturnType<typeof controllableReader>,
  options: ImportOptions,
) {
  await user.click(addButton());
  await user.upload(fileInput(), mp3(options.name));
  await reader.last().resolve(options.seconds);
  if (options.title !== undefined) {
    await user.clear(field('Título'));
    await user.type(field('Título'), options.title);
  }
  if (options.artist) await user.type(field('Artista (opcional)'), options.artist);
  if (options.placement === 'first') await user.click(field('Al inicio'));
  if (options.placement === 'at') {
    await user.click(field('En una posición'));
    await user.type(field(/^Posición/), options.position ?? '1');
  }
  await user.click(submit());
}

describe('estado inicial', () => {
  // Fase 3A: los controles de reproducción existen; sin canciones, los que no
  // tienen función están deshabilitados (antes la prueba exigía que no existieran).
  it('vacío, sin canciones ficticias y con los controles sin función deshabilitados', () => {
    setup();
    expect(screen.getByText('La playlist está vacía.')).toBeTruthy();
    expect(stats()).toBe('0 canciones · , duración total 0:00');
    expect(screen.queryByRole('button', { name: /cargar ejemplo/i })).toBeNull();
    expect((screen.getByRole('button', { name: 'Reproducir' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('slider', { name: 'Posición en la canción' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('playback-status').textContent).toBe('Sin canción');
    expect(screen.getByRole('button', { name: /Anterior/ }).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('diálogo de importación', () => {
  it('tiene selector MP3, duración de solo lectura y ningún campo de duración manual', async () => {
    const { user } = setup();
    await user.click(addButton());
    const input = fileInput();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.mp3,audio/mpeg');
    expect(document.activeElement).toBe(input);
    expect(field('Duración (detectada del archivo)').readOnly).toBe(true);
    expect(within(dialog()).queryByLabelText(/minutos/i)).toBeNull();
    expect(within(dialog()).queryByLabelText(/segundos/i)).toBeNull();
  });

  it('el campo de posición solo aparece con «En una posición»', async () => {
    const { user } = setup();
    await user.click(addButton());
    expect(within(dialog()).queryByLabelText(/^Posición/)).toBeNull();
    await user.click(field('En una posición'));
    await user.type(field(/^Posición/), '1');
    expect(field('En una posición').checked).toBe(true);
    await user.click(field('Al final'));
    expect(within(dialog()).queryByLabelText(/^Posición/)).toBeNull();
  });

  it('muestra nombre y tamaño, «Leyendo archivo…» y deshabilita Agregar mientras lee', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('Mi tema favorito.mp3', 4_404_019));

    expect(within(dialog()).getByText('Mi tema favorito.mp3')).toBeTruthy();
    expect(within(dialog()).getByText(/4,2 MB/)).toBeTruthy();
    expect(within(dialog()).getByText('Leyendo archivo…')).toBeTruthy();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(field('Título').value).toBe('Mi tema favorito');
    expect(screen.queryByRole('list', { name: 'Canciones' })).toBeNull(); // la playlist no cambia

    await reader.last().resolve(204.83);
    expect(within(dialog()).queryByText('Leyendo archivo…')).toBeNull();
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
    expect(field('Duración (detectada del archivo)').value).toBe('3:25 (204,83 s)');
  });

  it('importa: título del archivo, duración detectada y artista no especificado', async () => {
    const { user, reader } = setup();
    await importSong(user, reader, { name: 'Canción real.mp3', seconds: 204.01 });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rowLabels()).toEqual(['1. Canción real, artista no especificado, 3:25, seleccionada']);
    expect(within(rows()[0]!).getByText('Artista no especificado')).toBeTruthy();
    expect(selectedTitle()).toBe('Canción real');
    expect(screen.getAllByText('Artista no especificado').length).toBeGreaterThanOrEqual(2);
    expect(stats()).toBe('1 canción · , duración total 3:25');
    expect(document.activeElement).toBe(addButton());
  });

  it('título y artista editados por el usuario', async () => {
    const { user, reader } = setup();
    await importSong(user, reader, {
      name: 'archivo_feo_01.mp3',
      seconds: 61,
      title: 'Título bonito',
      artist: 'Alguien',
    });
    expect(rowLabels()).toEqual(['1. Título bonito, de Alguien, 1:01, seleccionada']);
  });

  it('elegir otro archivo reemplaza el título automático, pero no uno escrito a mano', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('primero.mp3'));
    expect(field('Título').value).toBe('primero');
    await user.upload(fileInput(), mp3('segundo.mp3'));
    expect(field('Título').value).toBe('segundo');
    await user.clear(field('Título'));
    await user.type(field('Título'), 'Mío');
    await user.upload(fileInput(), mp3('tercero.mp3'));
    expect(field('Título').value).toBe('Mío');
    await reader.last().resolve(10);
  });

  it('importa al inicio, al final y en una posición', async () => {
    const { user, reader } = setup();
    await importSong(user, reader, { name: 'B.mp3', seconds: 60 });
    await importSong(user, reader, { name: 'A.mp3', seconds: 30, placement: 'first' });
    await importSong(user, reader, { name: 'D.mp3', seconds: 90 });
    await importSong(user, reader, { name: 'C.mp3', seconds: 45, placement: 'at', position: '3' });
    expect(rowLabels().map((l) => l?.split(',')[0])).toEqual(['1. A', '2. B', '3. C', '4. D']);
    expect(selectedTitle()).toBe('B'); // la primera importación seleccionó B y se conserva
    expect(stats()).toBe('4 canciones · , duración total 3:45');
  });

  it('el mismo archivo se puede importar dos veces', async () => {
    const { user, reader } = setup();
    await importSong(user, reader, { name: 'repetido.mp3', seconds: 5 });
    await importSong(user, reader, { name: 'repetido.mp3', seconds: 5 });
    expect(rows()).toHaveLength(2);
    const ids = rows().map((row) => row.getAttribute('data-song-id'));
    expect(new Set(ids).size).toBe(2);
  });
});

describe('archivos inválidos y errores de lectura', () => {
  it.each([
    ['empty', 'El archivo está vacío.'],
    ['not-mp3', 'El archivo no es un MP3 válido.'],
    ['unsupported', 'El navegador no pudo leer el audio de este archivo. Puede estar dañado o no ser un MP3.'],
    ['read-error', 'No se pudo leer el archivo. Vuelve a seleccionarlo.'],
    ['timeout', 'La lectura del archivo tardó demasiado. Inténtalo de nuevo.'],
  ] as const)('error %s: lo muestra en el campo y no permite agregar', async (code, message) => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('malo.mp3'));
    await reader.last().reject(new AudioImportError(code, message));

    const input = fileInput();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby')!.split(' ');
    const errorText = describedBy.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(errorText).toContain(message);
    expect(field('Duración (detectada del archivo)').value).toBe('No disponible');

    await user.click(submit());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Canciones' })).toBeNull();
    expect(document.activeElement).toBe(fileInput());
  });

  it('sin archivo no se puede agregar', async () => {
    const { user } = setup();
    await user.click(addButton());
    await user.type(field('Título'), 'Sin archivo');
    await user.click(submit());
    expect(within(dialog()).getByText('Selecciona un archivo MP3.')).toBeTruthy();
    expect(document.activeElement).toBe(fileInput());
    expect(screen.queryByRole('list', { name: 'Canciones' })).toBeNull();
  });

  it('un archivo con otro tipo llega al lector aunque el selector lo filtre (no se confía en accept)', async () => {
    const { user, reader } = setup({ applyAccept: false });
    await user.click(addButton());
    await user.upload(fileInput(), mp3('sonido.wav', 100, 'audio/wav'));
    expect(reader.last().file.name).toBe('sonido.wav');
    await reader.last().reject(new AudioImportError('not-mp3', 'El archivo no es un MP3 válido.'));
    expect(within(dialog()).getByText('El archivo no es un MP3 válido.')).toBeTruthy();
  });

  it('un error de título o posición conserva los campos y el archivo válido', async () => {
    const { user, reader } = setup();
    await importSong(user, reader, { name: 'uno.mp3', seconds: 10 });
    await user.click(addButton());
    await user.upload(fileInput(), mp3('dos.mp3'));
    await reader.last().resolve(20);
    await user.clear(field('Título'));
    await user.type(field('Artista (opcional)'), 'Artista X');
    await user.click(field('En una posición'));
    await user.type(field(/^Posición/), '9');
    await user.click(submit());

    expect(field('Título').getAttribute('aria-invalid')).toBe('true');
    expect(field(/^Posición/).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field('Título'));
    expect(field('Artista (opcional)').value).toBe('Artista X');
    expect(field(/^Posición/).value).toBe('9');
    expect(field('Duración (detectada del archivo)').value).toBe('0:20 (20,00 s)');
    expect(within(dialog()).getByText('dos.mp3')).toBeTruthy();
    expect(reader.calls).toHaveLength(2); // no se volvió a leer

    await user.type(field('Título'), 'Dos');
    await user.clear(field(/^Posición/));
    await user.type(field(/^Posición/), '1');
    await user.click(submit());
    expect(rowLabels()[0]).toBe('1. Dos, de Artista X, 0:20');
  });

  it('si la inserción falla (id repetido) muestra el error y no deja la canción', async () => {
    const { user, reader } = setup({ generateId: () => 'repetido' });
    await importSong(user, reader, { name: 'uno.mp3', seconds: 10 });
    await importSong(user, reader, { name: 'dos.mp3', seconds: 10 });
    expect(within(dialog()).getByRole('alert').textContent).toBe(
      'Ya existe una canción con el id "repetido".',
    );
    expect(field('Título').value).toBe('dos');
    expect(rows()).toHaveLength(1);
  });
});

describe('respuestas obsoletas, cancelación y limpieza', () => {
  it('si se elige B antes de terminar A, A no sobrescribe B', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('A.mp3'));
    const a = reader.last();
    await user.upload(fileInput(), mp3('B.mp3'));
    const b = reader.last();
    expect(a.signal?.aborted).toBe(true); // la lectura de A se canceló

    await b.resolve(30);
    await a.resolve(999); // respuesta tardía de A: se ignora
    expect(field('Duración (detectada del archivo)').value).toBe('0:30 (30,00 s)');
    expect(within(dialog()).getByText('B.mp3')).toBeTruthy();

    await user.click(submit());
    expect(rowLabels()).toEqual(['1. B, artista no especificado, 0:30, seleccionada']);
  });

  it('una respuesta tardía de A no interrumpe la lectura en curso de B', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('A.mp3'));
    const a = reader.last();
    await user.upload(fileInput(), mp3('B.mp3'));
    await a.resolve(999);
    expect(within(dialog()).getByText('Leyendo archivo…')).toBeTruthy();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    await a.reject(new AudioImportError('timeout', 'tarde'));
    expect(within(dialog()).queryByText('tarde')).toBeNull();
  });

  it('cerrar el diálogo cancela la lectura y no agrega nada; reabrir empieza limpio', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('pendiente.mp3'));
    const pending = reader.last();
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pending.signal?.aborted).toBe(true);

    await user.click(addButton());
    await pending.resolve(42); // respuesta de la apertura anterior
    expect(within(dialog()).queryByText('pendiente.mp3')).toBeNull();
    expect(field('Título').value).toBe('');
    expect(field('Duración (detectada del archivo)').value).toBe('Se detecta al elegir el archivo');
    expect(screen.queryByRole('list', { name: 'Canciones' })).toBeNull();
  });

  it('Escape durante la lectura también cancela; desmontar el reproductor limpia', async () => {
    const { user, reader, unmount } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('uno.mp3'));
    await user.keyboard('{Escape}');
    expect(reader.last().signal?.aborted).toBe(true);
    expect(document.activeElement).toBe(addButton());

    await user.click(addButton());
    await user.upload(fileInput(), mp3('dos.mp3'));
    const second = reader.last();
    unmount();
    expect(second.signal?.aborted).toBe(true);
  });

  it('Cancelar después de leer un archivo válido no agrega la canción', async () => {
    const { user, reader } = setup();
    await user.click(addButton());
    await user.upload(fileInput(), mp3('valido.mp3'));
    await reader.last().resolve(12);
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('list', { name: 'Canciones' })).toBeNull();
    expect(stats()).toBe('0 canciones · , duración total 0:00');
  });
});

describe('foco y teclado del diálogo', () => {
  it('Tab y Shift+Tab no salen del diálogo; el resto queda inerte', async () => {
    const { user, container } = setup();
    await user.click(addButton());
    const shell = container.querySelector('main')!.parentElement!;
    expect(shell.hasAttribute('inert')).toBe(true);
    const close = within(dialog()).getByRole('button', { name: 'Cerrar' });
    submit().focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(submit());
    await user.click(close);
    expect(shell.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(addButton());
  });
});

describe('selección, navegación y eliminación', () => {
  async function threeSongs() {
    const ctx = setup();
    for (const [name, seconds] of [
      ['Uno.mp3', 60],
      ['Dos.mp3', 120],
      ['Tres.mp3', 180],
    ] as const) {
      await importSong(ctx.user, ctx.reader, { name, seconds });
    }
    return ctx;
  }

  it('seleccionar y navegar sin salir de los extremos', async () => {
    const { user } = await threeSongs();
    expect(selectedTitle()).toBe('Uno');
    await user.click(screen.getByRole('button', { name: /^2\. Dos/ }));
    expect(selectedTitle()).toBe('Dos');
    const next = screen.getByRole('button', { name: /Siguiente/ });
    await user.click(next);
    await user.click(next);
    expect(selectedTitle()).toBe('Tres');
    expect(next.getAttribute('aria-disabled')).toBe('true');
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(selectedTitle()).toBe('Dos');
  });

  it('eliminar la actual selecciona la siguiente; eliminar otra no cambia la selección', async () => {
    const { user } = await threeSongs();
    await user.click(screen.getByRole('button', { name: /^2\. Dos/ }));
    const id = currentId();
    await user.click(screen.getByRole('button', { name: 'Eliminar 1. Uno' }));
    expect(currentId()).toBe(id);
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^1\. Dos/);
    await user.click(screen.getByRole('button', { name: 'Eliminar 1. Dos' }));
    expect(selectedTitle()).toBe('Tres');
    await user.click(screen.getByRole('button', { name: 'Eliminar 1. Tres' }));
    expect(screen.getByText('Sin canción seleccionada')).toBeTruthy();
  });

  it('la selección conserva el mismo id ante espera, diálogo cancelado, importación previa, eliminación de otra y redimensionado', async () => {
    const { user, reader } = await threeSongs();
    await user.click(screen.getByRole('button', { name: /^2\. Dos/ }));
    const id = currentId();
    expect(id).not.toBeNull();

    await act(() => new Promise((resolve) => setTimeout(resolve, 300))); // sin interacción
    expect(currentId()).toBe(id);

    await user.click(addButton());
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));
    expect(currentId()).toBe(id);

    await importSong(user, reader, { name: 'Antes.mp3', seconds: 10, placement: 'first' });
    expect(currentId()).toBe(id);
    expect(selectedTitle()).toBe('Dos');

    await user.click(screen.getByRole('button', { name: 'Eliminar 4. Tres' }));
    expect(currentId()).toBe(id);

    fireEvent(window, new Event('resize'));
    expect(currentId()).toBe(id);
    expect(selectedTitle()).toBe('Dos');
  });
});

describe('una playlist por montaje', () => {
  it('dos reproductores no comparten estado', async () => {
    const reader = controllableReader();
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <div data-testid="a">
          <Player generateId={sequentialIds()} readMetadata={reader.read} />
        </div>
        <div data-testid="b">
          <Player generateId={sequentialIds()} readMetadata={reader.read} />
        </div>
      </>,
    );
    const a = within(screen.getByTestId('a'));
    await user.click(a.getByRole('button', { name: 'Agregar canción' }));
    await user.upload(within(screen.getByRole('dialog')).getByLabelText('Archivo MP3'), mp3('x.mp3'));
    await reader.last().resolve(5);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar' }));
    expect(a.getAllByRole('listitem')).toHaveLength(1);
    expect(within(screen.getByTestId('b')).queryAllByRole('listitem')).toHaveLength(0);
  });
});
