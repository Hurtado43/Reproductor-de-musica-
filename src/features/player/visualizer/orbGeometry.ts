import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Sphere, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { simplex3 } from './simplexNoise';

/** Parámetros de la esfera. Las velocidades están en unidades por segundo. */
export const ORB_CONFIG = {
  radius: 1,
  /**
   * Subdivisión del icosaedro. Vértices tras fusionar: 10·(detail+1)² + 2.
   * Escritorio: 28 → 8 412 vértices. Móvil: 18 → 3 612 vértices.
   */
  detailDesktop: 28,
  detailMobile: 18,
  /**
   * Capa de pliegues orgánicos. Solo aparece con música: su amplitud se
   * multiplica por la intensidad real (`orbIntensity`), así que en reposo la
   * forma es una esfera perfecta. Su tiempo es el tiempo musical de
   * `OrbAnimator`, que solo avanza con la señal real.
   */
  ambient: {
    /** Desplazamiento radial máximo de la capa principal (fracción del radio). */
    amplitude: 0.12,
    /** Frecuencia espacial baja → pliegues amplios. */
    frequency: 0.78,
    /** Velocidad del cambio de forma (lenta). */
    speed: 0.09,
    /** Segunda capa, más fina, relativa a `amplitude`. */
    detailAmplitude: 0.13,
    detailFrequency: 1.5,
  },
  /**
   * Respuesta al audio real (fase 3B). Con niveles 0 no aporta nada.
   * - `amplitude`: capa de ruido extra escalada por la energía global (RMS).
   * - `bassFoldBoost`: los graves amplían la capa principal (pliegues amplios)
   *   hasta un 20 %.
   * - `bassPulse`: los graves inflan el radio de forma uniforme (pulsación sutil, 3 %).
   */
  audio: {
    amplitude: 0.045,
    frequency: 1.4,
    speed: 0.45,
    bassFoldBoost: 0.2,
    bassPulse: 0.03,
  },
  /** Rotación lenta (radianes por segundo) y bamboleo del eje. */
  rotation: { speedY: 0.07, wobble: 0.12, wobbleSpeed: 0.05 },
  /** Instante fijo que se muestra con movimiento reducido. */
  staticTime: 6.5,
} as const;

/**
 * Desplazamiento máximo posible (para el `boundingSphere`): el ruido simplex
 * queda dentro de [-1, 1].
 */
export const MAX_DISPLACEMENT =
  ORB_CONFIG.ambient.amplitude *
    (1 + ORB_CONFIG.ambient.detailAmplitude) *
    (1 + ORB_CONFIG.audio.bassFoldBoost) +
  ORB_CONFIG.audio.amplitude +
  ORB_CONFIG.audio.bassPulse;

/**
 * Icosaedro subdividido con vértices fusionados (geometría indexada).
 *
 * `IcosahedronGeometry` repite los vértices en cada triángulo. Al quitar
 * `normal` y `uv` y fusionarlos, cada punto de la superficie es un único
 * vértice compartido: la deformación no abre grietas y `computeVertexNormals`
 * promedia las caras vecinas (sombreado suave, sin facetas).
 */
export function createOrbGeometry(detail: number): BufferGeometry {
  const raw = new IcosahedronGeometry(ORB_CONFIG.radius, detail);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const merged = mergeVertices(raw);
  raw.dispose();
  merged.computeVertexNormals();
  // Límite fijo que cubre cualquier deformación: no se recalcula por fotograma
  // y el objeto nunca se recorta por frustum culling.
  merged.boundingSphere = new Sphere(new Vector3(), ORB_CONFIG.radius * (1 + MAX_DISPLACEMENT));
  return merged;
}

/**
 * Intensidad de la deformación a partir de niveles reales: 0 = esfera perfecta,
 * 1 = pliegues completos. Energía y graves marcan el ritmo de la forma.
 */
export function orbIntensity(energy: number, bass: number): number {
  const value = 0.6 * energy + 0.4 * bass;
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

/**
 * Desplazamiento radial (fracción del radio) de un punto de la esfera unidad.
 * `energy` y `bass` son niveles reales en [0, 1]. Con ambos en 0 devuelve 0:
 * sin música, la esfera es redonda.
 */
export function orbDisplacement(
  x: number,
  y: number,
  z: number,
  timeSeconds: number,
  energy: number,
  bass = 0,
): number {
  const { ambient, audio } = ORB_CONFIG;
  const t = timeSeconds * ambient.speed;
  const f = ambient.frequency;
  const f2 = ambient.detailFrequency;

  // Capa principal: el dominio se desplaza despacio en tres ejes distintos,
  // así la forma cambia sin repetirse en un ciclo corto.
  let n = simplex3(x * f + t, y * f - t * 0.71, z * f + t * 0.43);
  n += ambient.detailAmplitude * simplex3(x * f2 - t * 1.3, y * f2 + t * 0.9, z * f2 + 11.7);
  const intensity = orbIntensity(energy, bass);
  if (intensity === 0) return 0; // reposo: esfera perfecta
  let d = ambient.amplitude * intensity * n;

  if (bass > 0) d = d * (1 + bass * audio.bassFoldBoost) + bass * audio.bassPulse;
  if (energy > 0) {
    const ta = timeSeconds * audio.speed;
    d +=
      energy *
      audio.amplitude *
      simplex3(x * audio.frequency + ta, y * audio.frequency - 5.3, z * audio.frequency - ta);
  }
  return d;
}

/**
 * Normales suaves (promedio ponderado por área de las caras vecinas), como
 * `BufferGeometry.computeVertexNormals`, pero directamente sobre los arreglos
 * tipados y sin crear objetos: en la geometría de escritorio es varias veces
 * más rápida, y es la parte más costosa de cada fotograma.
 */
export function computeSmoothNormals(
  positions: Float32Array,
  index: ArrayLike<number>,
  normals: Float32Array,
): void {
  normals.fill(0);
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f]! * 3;
    const b = index[f + 1]! * 3;
    const c = index[f + 2]! * 3;
    const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
    const e1x = positions[b]! - ax, e1y = positions[b + 1]! - ay, e1z = positions[b + 2]! - az;
    const e2x = positions[c]! - ax, e2y = positions[c + 1]! - ay, e2z = positions[c + 2]! - az;
    // Producto vectorial sin normalizar: su longitud es el doble del área.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    normals[a] = normals[a]! + nx; normals[a + 1] = normals[a + 1]! + ny; normals[a + 2] = normals[a + 2]! + nz;
    normals[b] = normals[b]! + nx; normals[b + 1] = normals[b + 1]! + ny; normals[b + 2] = normals[b + 2]! + nz;
    normals[c] = normals[c]! + nx; normals[c + 1] = normals[c + 1]! + ny; normals[c + 2] = normals[c + 2]! + nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i]!, y = normals[i + 1]!, z = normals[i + 2]!;
    const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    normals[i] = x * inv;
    normals[i + 1] = y * inv;
    normals[i + 2] = z * inv;
  }
}

/**
 * Deforma la esfera en cada fotograma a partir de las posiciones base.
 *
 * - Guarda una copia de las direcciones originales (esfera unidad) y escribe
 *   cada posición como `dirección · radio · (1 + desplazamiento)`. Nunca suma
 *   sobre la posición anterior, así que no acumula error ni deriva.
 * - Reutiliza los mismos buffers: no crea arreglos en el bucle.
 * - Recalcula las normales después de mover los vértices.
 */
export class OrbDeformer {
  readonly geometry: BufferGeometry;
  readonly #directions: Float32Array;
  readonly #positions: BufferAttribute;
  readonly #normals: BufferAttribute;
  readonly #index: ArrayLike<number>;

  constructor(detail: number) {
    this.geometry = createOrbGeometry(detail);
    this.#positions = this.geometry.getAttribute('position') as BufferAttribute;
    this.#normals = this.geometry.getAttribute('normal') as BufferAttribute;
    this.#index = this.geometry.getIndex()!.array;
    const source = this.#positions.array as Float32Array;
    this.#directions = new Float32Array(source.length);
    for (let i = 0; i < source.length; i += 3) {
      const x = source[i]!;
      const y = source[i + 1]!;
      const z = source[i + 2]!;
      const len = Math.hypot(x, y, z) || 1;
      this.#directions[i] = x / len;
      this.#directions[i + 1] = y / len;
      this.#directions[i + 2] = z / len;
    }
  }

  get vertexCount(): number {
    return this.#positions.count;
  }

  /** Copia de solo lectura de las direcciones base (para pruebas). */
  get baseDirections(): Readonly<Float32Array> {
    return this.#directions;
  }

  /** Calcula la forma en `timeSeconds` con los niveles de audio dados (0 = solo la forma base). */
  apply(timeSeconds: number, energy: number, bass = 0): void {
    const dirs = this.#directions;
    const out = this.#positions.array as Float32Array;
    const radius = ORB_CONFIG.radius;
    for (let i = 0; i < dirs.length; i += 3) {
      const x = dirs[i]!;
      const y = dirs[i + 1]!;
      const z = dirs[i + 2]!;
      const r = radius * (1 + orbDisplacement(x, y, z, timeSeconds, energy, bass));
      out[i] = x * r;
      out[i + 1] = y * r;
      out[i + 2] = z * r;
    }
    this.#positions.needsUpdate = true;
    computeSmoothNormals(out, this.#index, this.#normals.array as Float32Array);
    this.#normals.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
