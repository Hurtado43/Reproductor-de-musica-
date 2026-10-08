import { describe, expect, it } from 'vitest';
import { createSong, DoublyLinkedList, validateSongInput, type Song } from '../src/domain';
import { assertListInvariants } from './assertListInvariants';

describe('createSong', () => {
  it('crea una canción con id único y campos recortados', () => {
    const a = createSong({ title: '  Bohemian Rhapsody ', artist: ' Queen ', durationSeconds: 354 });
    const b = createSong({ title: 'Imagine', artist: 'John Lennon', durationSeconds: 183 });
    expect(a).toMatchObject({ title: 'Bohemian Rhapsody', artist: 'Queen', durationSeconds: 354 });
    expect(a.id).toBeTypeOf('string');
    expect(a.id).not.toBe(b.id);
  });

  it('acepta un generador de id inyectado', () => {
    const song = createSong({ title: 't', artist: 'a', durationSeconds: 1 }, () => 'id-1');
    expect(song.id).toBe('id-1');
  });

  it.each([
    [{ title: '  ', artist: 'a', durationSeconds: 10 }],
    [{ title: 't', artist: 'a', durationSeconds: 0 }],
    [{ title: 't', artist: 'a', durationSeconds: -5 }],
    [{ title: 't', artist: 'a', durationSeconds: 2.5 }],
    [{ title: 't', artist: 'a', durationSeconds: Number.NaN }],
  ])('rechaza datos inválidos %o', (input) => {
    expect(() => createSong(input)).toThrow();
  });

  it('se almacena en la lista doble y se busca por id', () => {
    const list = new DoublyLinkedList<Song>();
    const songs = ['A', 'B', 'C'].map((t, i) =>
      createSong({ title: t, artist: 'X', durationSeconds: 60 + i }),
    );
    for (const s of songs) list.insertLast(s);
    assertListInvariants(list, songs);
    const target = list.find((s) => s.id === songs[1]!.id)!;
    expect(list.remove(target)).toBe(true);
    assertListInvariants(list, [songs[0], songs[2]]);
  });
});

describe('validateSongInput', () => {
  it('devuelve un objeto vacío si todo es válido', () => {
    expect(validateSongInput({ title: 't', artist: 'a', durationSeconds: 1 })).toEqual({});
  });

  it('devuelve un mensaje por cada campo inválido (el artista es opcional)', () => {
    expect(validateSongInput({ title: ' ', artist: '', durationSeconds: 0 })).toEqual({
      title: 'El título no puede estar vacío.',
      durationSeconds: 'La duración debe ser un número entero de segundos mayor que 0.',
    });
  });

  it('createSong lanza el mensaje del primer campo inválido', () => {
    expect(() => createSong({ title: '', artist: '', durationSeconds: 0 })).toThrow(
      'El título no puede estar vacío.',
    );
    expect(() => createSong({ title: 't', artist: 'a', durationSeconds: -1 })).toThrow(
      'La duración debe ser un número entero de segundos mayor que 0.',
    );
  });
});

describe('artista opcional', () => {
  it.each([undefined, null, '', '   '])('artista %o se guarda como null', (artist) => {
    const song = createSong({ title: 'T', artist, durationSeconds: 5 });
    expect(song.artist).toBeNull();
  });

  it('sin la propiedad artist también se guarda null', () => {
    expect(createSong({ title: 'T', durationSeconds: 5 }).artist).toBeNull();
  });

  it('un artista indicado se recorta y se conserva', () => {
    expect(createSong({ title: 'T', artist: '  Alguien ', durationSeconds: 5 }).artist).toBe('Alguien');
  });
});
