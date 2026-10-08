import { describe, expect, it } from 'vitest';
import { createSong } from '../src/domain';
import { filterSongs, normalizeForSearch, songMatches } from '../src/features/player/songSearch';

const song = (id: string, title: string, artist: string | null = null) =>
  createSong({ title, artist, durationSeconds: 10 }, () => id);

describe('búsqueda en la playlist', () => {
  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(normalizeForSearch('  Canción  ÁRBOL ñandú ')).toBe('cancion arbol nandu');
  });

  it('busca por título y por artista, sin distinguir mayúsculas ni acentos', () => {
    const s = song('a', 'Canción de cuna', 'José Álvarez');
    expect(songMatches(s, 'CANCION')).toBe(true);
    expect(songMatches(s, 'cuna')).toBe(true);
    expect(songMatches(s, 'jose')).toBe(true);
    expect(songMatches(s, 'ÁLVAREZ')).toBe(true);
    expect(songMatches(s, 'rock')).toBe(false);
    expect(songMatches(song('b', 'Sin artista'), 'artista no especificado')).toBe(false);
  });

  it('vacía o solo espacios: todo coincide', () => {
    expect(songMatches(song('a', 'X'), '')).toBe(true);
    expect(songMatches(song('a', 'X'), '   ')).toBe(true);
  });

  it('conserva el orden y el índice de la playlist completa', () => {
    const songs = [song('a', 'Uno'), song('b', 'Dos', 'Ana'), song('c', 'Tres'), song('d', 'Adiós', 'Luis')];
    expect(filterSongs(songs, 'an').map((r) => [r.song.id, r.index])).toEqual([['b', 1]]);
    expect(filterSongs(songs, 'os').map((r) => [r.song.id, r.index])).toEqual([
      ['b', 1],
      ['d', 3],
    ]);
    expect(filterSongs(songs, 'zzz')).toEqual([]);
  });
});
