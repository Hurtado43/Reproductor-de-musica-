import { describe, expect, it } from 'vitest';
import { createSong } from '../src/domain';
import {
  SCHEMA_VERSION,
  toStoredSong,
  validateStoredLibrary,
  type RawLibraryData,
} from '../src/features/player/persistence/librarySchema';

/*
 * Validación de lo leído de IndexedDB (función pura). Los datos son registros
 * construidos en la prueba, no una base real.
 */

const mp3 = (name: string, bytes = 32) => new File([new Uint8Array(bytes).fill(7)], name, { type: 'audio/mpeg' });

function record(id: string, title: string, overrides: Record<string, unknown> = {}, createdAt = 0) {
  const song = createSong({ title, durationSeconds: 8 }, () => id);
  return { ...toStoredSong(song, { file: mp3(`${title}.mp3`), fileName: `${title}.mp3`, durationSeconds: 7.24 }, createdAt), ...overrides };
}

function library(order: unknown[], extra: Record<string, unknown> = {}) {
  return { key: 'library', schemaVersion: SCHEMA_VERSION, order, selectedId: null, volume: 1, muted: false, revision: 3, savedAt: 0, ...extra };
}

const ok = (raw: RawLibraryData) => {
  const result = validateStoredLibrary(raw);
  if (result.kind !== 'ok') throw new Error('se esperaba ok');
  return result.library;
};

describe('validateStoredLibrary', () => {
  it('biblioteca vacía (base nueva)', () => {
    const lib = ok({ songs: [], library: undefined });
    expect(lib.entries).toEqual([]);
    expect(lib.selectedId).toBeNull();
    expect(lib).toMatchObject({ volume: 1, muted: false, problems: [] });
  });

  it('restaura archivos, ids, orden, selección y preferencias', () => {
    const lib = ok({
      songs: [record('b', 'Dos'), record('a', 'Uno'), record('c', 'Tres')],
      library: library(['a', 'b', 'c'], { selectedId: 'b', volume: 0.35, muted: true }),
    });
    expect(lib.entries.map((e) => e.song.id)).toEqual(['a', 'b', 'c']);
    expect(lib.entries.map((e) => e.song.title)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(lib).toMatchObject({ selectedId: 'b', volume: 0.35, muted: true, revision: 3, problems: [] });
    const source = lib.entries[0]!.source;
    expect(source.file).toBeInstanceOf(File);
    expect(source.file.name).toBe('Uno.mp3');
    expect(source.file.size).toBe(32);
    expect(source.durationSeconds).toBe(7.24);
  });

  it('títulos repetidos con ids distintos se conservan', () => {
    const lib = ok({ songs: [record('x1', 'Igual'), record('x2', 'Igual')], library: library(['x2', 'x1']) });
    expect(lib.entries.map((e) => [e.song.id, e.song.title])).toEqual([
      ['x2', 'Igual'],
      ['x1', 'Igual'],
    ]);
  });

  it('un Blob sin nombre se reconstruye como File con su nombre y tipo', () => {
    const blobRecord = record('a', 'Uno', { file: new Blob([new Uint8Array(10)], { type: 'audio/mpeg' }) });
    const lib = ok({ songs: [blobRecord], library: library(['a']) });
    const file = lib.entries[0]!.source.file;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('Uno.mp3');
    expect(file.type).toBe('audio/mpeg');
  });

  it('descarta y explica las entradas dañadas, sin mostrar canciones sin archivo', () => {
    const lib = ok({
      songs: [
        record('a', 'Buena'),
        record('b', 'Vacía', { file: new Blob([]) }),
        record('c', 'Sin archivo', { file: undefined }),
        record('d', 'Duración', { preciseDurationSeconds: Number.NaN }),
        record('e', 'Entera', { durationSeconds: 2.5 }),
        record('f', 'Blanco', { title: '   ' }),
        record('g', 'Sin id', { id: '' }),
        'basura',
        record('a', 'Repetida'),
      ],
      library: library(['a', 'b', 'c', 'd', 'e', 'f', '', 'a'], { selectedId: 'c' }),
    });
    expect(lib.entries.map((e) => e.song.id)).toEqual(['a']);
    expect(lib.selectedId).toBe('a'); // la seleccionada no era válida → la primera
    const text = lib.problems.join('\n');
    expect(text).toContain('«Vacía»: falta el archivo de audio o está vacío.');
    expect(text).toContain('«Sin archivo»: falta el archivo');
    expect(text).toContain('«Duración»: duración no válida.');
    expect(text).toContain('«Entera»: metadatos no válidos.');
    expect(text).toContain('identificador repetido');
    expect(text).toContain('La canción seleccionada no se pudo recuperar');
  });

  it('orden con ids desconocidos o repetidos y archivos sin referencia', () => {
    const lib = ok({
      songs: [record('a', 'Uno'), record('b', 'Dos'), record('z', 'Suelta')],
      library: library(['a', 'perdida', 'a', 7, 'b'], { selectedId: 'b' }),
    });
    expect(lib.entries.map((e) => e.song.id)).toEqual(['a', 'b']);
    expect(lib.selectedId).toBe('b');
    expect(lib.problems.join('\n')).toMatch(/3 entradas del orden guardado no tenían/);
    expect(lib.problems.join('\n')).toMatch(/1 archivo guardado no figuraba en la playlist/);
  });

  it('sin registro de orden: recupera por fecha de importación y lo informa', () => {
    const lib = ok({
      songs: [record('b', 'Dos', {}, 20), record('a', 'Uno', {}, 10)],
      library: undefined,
    });
    expect(lib.entries.map((e) => e.song.id)).toEqual(['a', 'b']);
    expect(lib.selectedId).toBe('a');
    expect(lib.problems[0]).toMatch(/orden de importación/);
  });

  it('registro de orden dañado', () => {
    const lib = ok({ songs: [record('a', 'Uno')], library: { key: 'library', order: 'no' } });
    expect(lib.entries.map((e) => e.song.id)).toEqual(['a']);
    expect(lib.problems.length).toBeGreaterThan(0);
    expect(ok({ songs: [], library: 42 }).problems[0]).toMatch(/dañado/);
  });

  it('volumen y silencio inválidos vuelven a los valores por defecto', () => {
    for (const volume of [-0.1, 1.5, Number.NaN, '0.5']) {
      const lib = ok({ songs: [], library: library([], { volume, muted: 'sí' }) });
      expect(lib.volume).toBe(1);
      expect(lib.muted).toBe(false);
      expect(lib.problems.length).toBe(2);
    }
    expect(ok({ songs: [], library: library([], { volume: 0 }) }).volume).toBe(0);
  });

  it('versión de esquema más reciente: incompatible, sin recuperar nada', () => {
    const result = validateStoredLibrary({
      songs: [record('a', 'Uno')],
      library: library(['a'], { schemaVersion: SCHEMA_VERSION + 1 }),
    });
    expect(result.kind).toBe('incompatible');
  });
});

describe('modo de repetición guardado (fase 4B, mismo esquema)', () => {
  it('datos anteriores sin el campo: sin repetición y sin aviso', () => {
    const lib = ok({ songs: [record('a', 'Uno')], library: library(['a']) });
    expect(lib.repeatMode).toBe('off');
    expect(lib.problems).toEqual([]);
  });

  it('valores válidos se restauran', () => {
    for (const mode of ['off', 'all', 'one'] as const) {
      expect(ok({ songs: [], library: library([], { repeatMode: mode }) }).repeatMode).toBe(mode);
    }
  });

  it('un valor inválido usa "sin repetición" y se informa', () => {
    const lib = ok({ songs: [], library: library([], { repeatMode: 'siempre' }) });
    expect(lib.repeatMode).toBe('off');
    expect(lib.problems.join('\n')).toMatch(/modo de repetición/);
  });
});

describe('preferencia de aleatorio guardada (fase 5, mismo esquema)', () => {
  it('datos anteriores sin el campo: desactivado y sin aviso', () => {
    const lib = ok({ songs: [record('a', 'Uno')], library: library(['a']) });
    expect(lib.shuffle).toBe(false);
    expect(lib.problems).toEqual([]);
  });

  it('true y false se restauran', () => {
    expect(ok({ songs: [], library: library([], { shuffle: true }) }).shuffle).toBe(true);
    expect(ok({ songs: [], library: library([], { shuffle: false }) }).shuffle).toBe(false);
  });

  it('un valor inválido usa desactivado y se informa', () => {
    const lib = ok({ songs: [], library: library([], { shuffle: 'sí' }) });
    expect(lib.shuffle).toBe(false);
    expect(lib.problems.join('\n')).toMatch(/aleatoria/);
  });
});
