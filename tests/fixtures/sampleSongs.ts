import type { SongInput } from '../../src/domain';

/**
 * Cinco canciones ficticias (títulos y artistas inventados) para pruebas del
 * dominio. La aplicación ya no las ofrece: solo importa archivos MP3 reales.
 */
export const SAMPLE_SONGS: readonly SongInput[] = [
  { title: 'Marea de neón', artist: 'Los Satélites Lentos', durationSeconds: 214 },
  { title: 'Ciudad de cristal', artist: 'Aurora Delta', durationSeconds: 187 },
  { title: 'Kilómetro cero', artist: 'Bruma Norte', durationSeconds: 243 },
  { title: 'Luz de faro', artist: 'Valeria Sur', durationSeconds: 199 },
  { title: 'Órbita lenta', artist: 'Colectivo Turquesa', durationSeconds: 262 },
];
