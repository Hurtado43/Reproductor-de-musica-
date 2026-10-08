import type { Song } from '@/domain';

/**
 * Búsqueda en la playlist (fase 4B). Solo afecta a la presentación: no cambia
 * el orden de la lista enlazada, la selección ni la reproducción.
 */

/** Minúsculas, sin acentos ni diacríticos y con los espacios normalizados. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `true` si el título o el artista contienen la búsqueda (vacía = todo coincide). */
export function songMatches(song: Song, query: string): boolean {
  const needle = normalizeForSearch(query);
  if (needle === '') return true;
  return (
    normalizeForSearch(song.title).includes(needle) ||
    (song.artist !== null && normalizeForSearch(song.artist).includes(needle))
  );
}

export interface SearchResult {
  readonly song: Song;
  /** Índice en la playlist completa (para mostrar la posición real). */
  readonly index: number;
}

/** Canciones que coinciden, en el orden de la playlist y con su índice completo. */
export function filterSongs(songs: readonly Song[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  songs.forEach((song, index) => {
    if (songMatches(song, query)) results.push({ song, index });
  });
  return results;
}
