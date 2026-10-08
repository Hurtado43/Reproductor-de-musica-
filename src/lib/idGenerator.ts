/** Subconjunto de Web Crypto que usa el generador (inyectable en pruebas). */
export interface CryptoSource {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
}

/**
 * Crea un generador de ids para canciones.
 *
 * 1. Si `crypto.randomUUID` existe, lo usa. En el navegador solo está disponible
 *    en contextos seguros (HTTPS o localhost).
 * 2. Si no existe o falla, usa un id local `local-<sesión>-<tiempo>-<contador>`:
 *    - `sesión`: 8 caracteres aleatorios, calculados una sola vez en la primera
 *      llamada (no al crear el generador), con `crypto.getRandomValues` si existe
 *      (también funciona en contextos no seguros) o `Math.random` como último recurso.
 *    - `tiempo`: `Date.now()` en base 36.
 *    - `contador`: crece en cada llamada, así que dos ids del mismo generador
 *      nunca coinciden aunque se pidan en el mismo milisegundo.
 *
 * Estos ids alternativos son únicos dentro de la aplicación (una playlist por
 * montaje), no globalmente. Además, `Playlist` rechaza ids duplicados.
 */
export function createIdGenerator(
  source: CryptoSource | undefined = globalThis.crypto as CryptoSource | undefined,
): () => string {
  let session: string | null = null;
  let counter = 0;

  return () => {
    if (typeof source?.randomUUID === 'function') {
      try {
        return source.randomUUID();
      } catch {
        // Se usa la alternativa local.
      }
    }
    session ??= randomSessionChunk(source);
    counter += 1;
    return `local-${session}-${Date.now().toString(36)}-${counter.toString(36)}`;
  };
}

function randomSessionChunk(source: CryptoSource | undefined): string {
  const bytes = new Uint8Array(4);
  let filled = false;
  if (typeof source?.getRandomValues === 'function') {
    try {
      source.getRandomValues(bytes);
      filled = true;
    } catch {
      // Se usa Math.random.
    }
  }
  if (!filled) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
