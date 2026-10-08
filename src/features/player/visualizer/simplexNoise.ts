/**
 * Ruido simplex 3D (algoritmo clásico de Ken Perlin, en la formulación de
 * Stefan Gustavson). Devuelve valores suaves y continuos en, aproximadamente,
 * [-1, 1]. Sin dependencias y sin asignar memoria por llamada, para usarlo en
 * el bucle de animación sobre miles de vértices.
 */

const F3 = 1 / 3;
const G3 = 1 / 6;

/** Los 12 gradientes hacia las aristas de un cubo, aplanados (x, y, z). */
const GRADIENTS = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

/** Tabla de permutación duplicada (512) para evitar el módulo en los índices. */
const PERM = new Uint8Array(512);
/** Índice de gradiente (0–11) ya multiplicado por 3 para leer GRADIENTS. */
const GRAD_INDEX = new Uint8Array(512);

(function buildPermutation(seed: number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Mezcla determinista (LCG), para que la forma sea la misma en cada carga.
  let state = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = p[i]!;
    p[i] = p[j]!;
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255]!;
    GRAD_INDEX[i] = (PERM[i]! % 12) * 3;
  }
})(20261007);

function corner(gi: number, x: number, y: number, z: number): number {
  let t = 0.6 - x * x - y * y - z * z;
  if (t <= 0) return 0;
  t *= t;
  return t * t * (GRADIENTS[gi]! * x + GRADIENTS[gi + 1]! * y + GRADIENTS[gi + 2]! * z);
}

/** Ruido simplex en (x, y, z). Continuo y con derivadas continuas. */
export function simplex3(x: number, y: number, z: number): number {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);

  // Qué tetraedro del simplex contiene el punto (asignaciones sin arreglos
  // temporales: esta función se llama miles de veces por fotograma).
  let i1 = 0, j1 = 0, k1 = 0, i2 = 0, j2 = 0, k2 = 0;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; i2 = 1; j2 = 1; }
    else if (x0 >= z0) { i1 = 1; i2 = 1; k2 = 1; }
    else { k1 = 1; i2 = 1; k2 = 1; }
  } else if (y0 < z0) { k1 = 1; j2 = 1; k2 = 1; }
  else if (x0 < z0) { j1 = 1; j2 = 1; k2 = 1; }
  else { j1 = 1; i2 = 1; j2 = 1; }

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  const n0 = corner(GRAD_INDEX[ii + PERM[jj + PERM[kk]!]!]!, x0, y0, z0);
  const n1 = corner(
    GRAD_INDEX[ii + i1 + PERM[jj + j1 + PERM[kk + k1]!]!]!,
    x0 - i1 + G3,
    y0 - j1 + G3,
    z0 - k1 + G3,
  );
  const n2 = corner(
    GRAD_INDEX[ii + i2 + PERM[jj + j2 + PERM[kk + k2]!]!]!,
    x0 - i2 + 2 * G3,
    y0 - j2 + 2 * G3,
    z0 - k2 + 2 * G3,
  );
  const n3 = corner(
    GRAD_INDEX[ii + 1 + PERM[jj + 1 + PERM[kk + 1]!]!]!,
    x0 - 1 + 3 * G3,
    y0 - 1 + 3 * G3,
    z0 - 1 + 3 * G3,
  );
  return 32 * (n0 + n1 + n2 + n3);
}
