/** Bytes iniciales que se examinan para reconocer un MP3. */
export const MP3_SNIFF_BYTES = 4096;

const MP3_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3']);

/**
 * `true` si el archivo se declara como MP3 por su extensión `.mp3` o por su tipo
 * MIME. Un `type` vacío no descarta el archivo (algunos sistemas no lo informan).
 * Es solo un primer filtro: después se revisan los bytes y los metadatos de audio.
 */
export function isDeclaredMp3(file: { readonly name: string; readonly type: string }): boolean {
  return /\.mp3$/i.test(file.name) || MP3_MIME_TYPES.has(file.type.toLowerCase());
}

function startsWithAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** Cabecera de trama MPEG-1/2/2.5 Layer III válida a partir de `i`. */
function isLayer3FrameHeader(bytes: Uint8Array, i: number): boolean {
  const b0 = bytes[i];
  const b1 = bytes[i + 1];
  const b2 = bytes[i + 2];
  if (b0 === undefined || b1 === undefined || b2 === undefined) return false;
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return false; // sincronización (11 bits)
  const version = (b1 >> 3) & 0b11; // 01 = reservado
  const layer = (b1 >> 1) & 0b11; // 01 = Layer III
  const bitrate = b2 >> 4; // 1111 = inválido
  const sampleRate = (b2 >> 2) & 0b11; // 11 = reservado
  return version !== 0b01 && layer === 0b01 && bitrate !== 0b1111 && sampleRate !== 0b11;
}

/**
 * Heurística sobre los primeros bytes: `true` si empiezan con una etiqueta ID3v2
 * o contienen una cabecera de trama MPEG Layer III. Rechaza contenedores
 * conocidos que no son MP3 (WAV/RIFF, Ogg, FLAC, MP4).
 */
export function looksLikeMp3(bytes: Uint8Array): boolean {
  if (startsWithAscii(bytes, 'ID3')) return true;
  if (
    startsWithAscii(bytes, 'RIFF') ||
    startsWithAscii(bytes, 'OggS') ||
    startsWithAscii(bytes, 'fLaC') ||
    startsWithAscii(bytes, 'ftyp', 4)
  ) {
    return false;
  }
  for (let i = 0; i + 2 < bytes.length; i++) {
    if (isLayer3FrameHeader(bytes, i)) return true;
  }
  return false;
}
