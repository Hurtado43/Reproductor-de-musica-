/** Formatea segundos como `m:ss`, o `h:mm:ss` desde una hora. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** "1 canción" / "5 canciones". */
export function formatSongCount(count: number): string {
  return `${count} ${count === 1 ? 'canción' : 'canciones'}`;
}

/** Texto que se muestra cuando una canción no tiene artista. */
export const UNKNOWN_ARTIST = 'Artista no especificado';

/** Artista para mostrar; nunca inventa un nombre. */
export function displayArtist(artist: string | null): string {
  return artist ?? UNKNOWN_ARTIST;
}

const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });
const preciseSeconds = new Intl.NumberFormat('es', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Tamaño de archivo legible: "820 B", "12,4 KB", "4,2 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${decimal.format(bytes / 1024)} KB`;
  return `${decimal.format(bytes / (1024 * 1024))} MB`;
}

/** Segundos con dos decimales: "204,83 s". */
export function formatPreciseSeconds(seconds: number): string {
  return `${preciseSeconds.format(seconds)} s`;
}
