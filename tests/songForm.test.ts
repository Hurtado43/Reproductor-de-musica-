import { describe, expect, it } from 'vitest';
import type { AudioFileState } from '../src/features/player/audio/useAudioFileReader';
import {
  displayArtist,
  formatDuration,
  formatFileSize,
  formatPreciseSeconds,
  formatSongCount,
  UNKNOWN_ARTIST,
} from '../src/features/player/format';
import {
  EMPTY_SONG_FORM,
  parseSongForm,
  resultingVisiblePosition,
  titleFromFileName,
  toDomainDurationSeconds,
  toInternalIndex,
  toVisiblePosition,
  type SongFormValues,
} from '../src/features/player/songForm';

const mp3 = new File([new Uint8Array([0x49, 0x44, 0x33, 4])], 'Mi canción.mp3', { type: 'audio/mpeg' });
const ready: AudioFileState = { status: 'ready', file: mp3, durationSeconds: 204.83 };
const valid: SongFormValues = { ...EMPTY_SONG_FORM, title: 'Mi canción' };

describe('posiciones visibles e índices internos', () => {
  it('convierte en ambos sentidos', () => {
    expect(toInternalIndex(1)).toBe(0);
    expect(toInternalIndex(4)).toBe(3);
    expect(toVisiblePosition(0)).toBe(1);
    for (let i = 0; i < 10; i++) expect(toInternalIndex(toVisiblePosition(i))).toBe(i);
  });

  it('la posición visible de una inserción', () => {
    expect(resultingVisiblePosition({ kind: 'first' }, 4)).toBe(1);
    expect(resultingVisiblePosition({ kind: 'last' }, 4)).toBe(5);
    expect(resultingVisiblePosition({ kind: 'at', index: 2 }, 4)).toBe(3);
  });
});

describe('duración detectada → dominio', () => {
  it.each([
    [204.83, 205],
    [204.01, 205],
    [3, 3],
    [0.4, 1],
    [59.0001, 60],
  ])('%s s precisos → %s s enteros (hacia arriba)', (precise, whole) => {
    expect(toDomainDurationSeconds(precise)).toBe(whole);
  });
});

describe('título desde el nombre del archivo', () => {
  it.each([
    ['Mi canción.mp3', 'Mi canción'],
    ['TEMA.MP3', 'TEMA'],
    ['con.puntos.en.el.nombre.mp3', 'con.puntos.en.el.nombre'],
    ['  espacios  .mp3', 'espacios'],
    ['.mp3', ''],
    ['sin-extension', 'sin-extension'],
  ])('%s → %s', (name, title) => {
    expect(titleFromFileName(name)).toBe(title);
  });
});

describe('parseSongForm: datos válidos', () => {
  it('arma la solicitud con la duración entera para el dominio y la precisa para la fuente', () => {
    const result = parseSongForm(valid, 0, ready);
    expect(result).toEqual({
      ok: true,
      request: {
        input: { title: 'Mi canción', artist: '', durationSeconds: 205 },
        placement: { kind: 'last' },
        source: { file: mp3, fileName: 'Mi canción.mp3', durationSeconds: 204.83 },
      },
    });
    if (result.ok) expect(result.request.source.file).toBe(mp3);
  });

  it('el artista es opcional y se pasa tal cual (el dominio lo normaliza)', () => {
    const result = parseSongForm({ ...valid, artist: '  Alguien ' }, 0, ready);
    expect(result.ok && result.request.input.artist).toBe('  Alguien ');
  });

  it('inicio y posición específica (visible → interno)', () => {
    expect(parseSongForm({ ...valid, placement: 'first' }, 3, ready)).toMatchObject({
      ok: true,
      request: { placement: { kind: 'first' } },
    });
    expect(parseSongForm({ ...valid, placement: 'at', position: '1' }, 3, ready)).toMatchObject({
      ok: true,
      request: { placement: { kind: 'at', index: 0 } },
    });
    expect(parseSongForm({ ...valid, placement: 'at', position: '4' }, 3, ready)).toMatchObject({
      ok: true,
      request: { placement: { kind: 'at', index: 3 } },
    });
  });

  it('ignora la posición escrita si la ubicación no es específica', () => {
    expect(parseSongForm({ ...valid, placement: 'last', position: 'abc' }, 2, ready)).toMatchObject({
      ok: true,
      request: { placement: { kind: 'last' } },
    });
  });

  it('el formulario no tiene campos de duración manual', () => {
    expect(Object.keys(EMPTY_SONG_FORM).sort()).toEqual(['artist', 'placement', 'position', 'title']);
  });
});

describe('parseSongForm: errores', () => {
  it.each<[AudioFileState, string]>([
    [{ status: 'empty' }, 'Selecciona un archivo MP3.'],
    [{ status: 'reading', file: mp3 }, 'Espera a que termine la lectura del archivo.'],
    [{ status: 'error', file: mp3, message: 'El archivo está vacío.' }, 'El archivo está vacío.'],
  ])('sin un MP3 válido no se puede agregar (%o)', (file, message) => {
    expect(parseSongForm(valid, 0, file)).toEqual({ ok: false, errors: { file: message } });
  });

  it('título vacío usa la validación del dominio y conserva el archivo listo', () => {
    const result = parseSongForm({ ...valid, title: '   ' }, 0, ready);
    expect(result).toEqual({ ok: false, errors: { title: 'El título no puede estar vacío.' } });
    expect(ready).toEqual({ status: 'ready', file: mp3, durationSeconds: 204.83 });
  });

  it.each(['0', '5', '-1', '1.5', '', 'dos'])(
    'posición "%s" con 3 canciones → error (válidas: 1 a 4)',
    (position) => {
      const result = parseSongForm({ ...valid, placement: 'at', position }, 3, ready);
      expect(result).toEqual({
        ok: false,
        errors: { position: 'Escribe una posición entera entre 1 y 4.' },
      });
    },
  );

  it('en una playlist vacía la única posición válida es 1', () => {
    expect(parseSongForm({ ...valid, placement: 'at', position: '1' }, 0, ready).ok).toBe(true);
    expect(parseSongForm({ ...valid, placement: 'at', position: '2' }, 0, ready).ok).toBe(false);
  });

  it('reporta todos los errores a la vez y no modifica los valores', () => {
    const values: SongFormValues = { title: '', artist: 'x', placement: 'at', position: '9' };
    const copy = { ...values };
    const result = parseSongForm(values, 1, { status: 'empty' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['file', 'position', 'title']);
    expect(values).toEqual(copy);
  });
});

describe('formato', () => {
  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(185)).toBe('3:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formatSongCount', () => {
    expect(formatSongCount(0)).toBe('0 canciones');
    expect(formatSongCount(1)).toBe('1 canción');
    expect(formatSongCount(5)).toBe('5 canciones');
  });

  it('formatFileSize y formatPreciseSeconds', () => {
    expect(formatFileSize(820)).toBe('820 B');
    expect(formatFileSize(12_700)).toBe('12,4 KB');
    expect(formatFileSize(4_404_019)).toBe('4,2 MB');
    expect(formatPreciseSeconds(204.8312)).toBe('204,83 s');
  });

  it('displayArtist no inventa un artista', () => {
    expect(displayArtist(null)).toBe(UNKNOWN_ARTIST);
    expect(UNKNOWN_ARTIST).toBe('Artista no especificado');
    expect(displayArtist('Alguien')).toBe('Alguien');
  });
});
