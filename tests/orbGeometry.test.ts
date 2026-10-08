import { describe, expect, it } from 'vitest';
import { clamp01, SILENT_AUDIO, SILENT_AUDIO_INPUT, smoothTowards } from '../src/features/player/visualizer/orbAudio';
import {
  computeSmoothNormals,
  createOrbGeometry,
  MAX_DISPLACEMENT,
  ORB_CONFIG,
  orbDisplacement,
  OrbDeformer,
} from '../src/features/player/visualizer/orbGeometry';
import { simplex3 } from '../src/features/player/visualizer/simplexNoise';

/*
 * Pruebas de la lógica de geometría (TypeScript + three, sin WebGL). El render
 * real se comprueba en un navegador con WebGL (ver docs/progreso.md).
 */

const DETAIL = 10;

function positions(deformer: OrbDeformer): Float32Array {
  return new Float32Array(deformer.geometry.getAttribute('position').array as Float32Array);
}

describe('ruido simplex', () => {
  it('es determinista, continuo y acotado', () => {
    let max = 0;
    for (let i = 0; i < 5000; i++) {
      const x = Math.sin(i) * 7;
      const y = Math.cos(i * 1.3) * 7;
      const z = i * 0.013;
      const v = simplex3(x, y, z);
      expect(v).toBe(simplex3(x, y, z));
      max = Math.max(max, Math.abs(v));
      // Continuidad: un paso pequeño produce un cambio pequeño.
      expect(Math.abs(simplex3(x + 1e-4, y, z) - v)).toBeLessThan(0.01);
    }
    expect(max).toBeLessThanOrEqual(1);
    expect(max).toBeGreaterThan(0.5);
  });
});

describe('geometría de la esfera', () => {
  it('es indexada y sin vértices duplicados (no se abren grietas al deformar)', () => {
    const g = createOrbGeometry(DETAIL);
    const pos = g.getAttribute('position');
    expect(g.getIndex()).not.toBeNull();
    expect(pos.count).toBe(10 * (DETAIL + 1) ** 2 + 2);
    const keys = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      keys.add(`${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`);
    }
    expect(keys.size).toBe(pos.count);
    expect(g.getAttribute('uv')).toBeUndefined();
    g.dispose();
  });

  it('tiene un boundingSphere fijo que cubre la deformación máxima', () => {
    const g = createOrbGeometry(DETAIL);
    expect(g.boundingSphere!.radius).toBeCloseTo(ORB_CONFIG.radius * (1 + MAX_DISPLACEMENT));
    g.dispose();
  });
});

describe('deformación', () => {
  it('se calcula siempre desde las posiciones base (no acumula)', () => {
    const a = new OrbDeformer(DETAIL);
    for (let k = 0; k < 50; k++) a.apply(k * 0.37, 0); // muchas actualizaciones
    a.apply(12.5, 0);
    const b = new OrbDeformer(DETAIL);
    b.apply(12.5, 0); // una sola
    expect(positions(a)).toEqual(positions(b));
  });

  it('es una función del tiempo, no del número de fotogramas', () => {
    const a = new OrbDeformer(DETAIL);
    a.apply(3, 0);
    const b = new OrbDeformer(DETAIL);
    for (let k = 1; k <= 180; k++) b.apply(k / 60, 0); // 3 s a 60 fps
    expect(positions(a)).toEqual(positions(b));
  });

  // Requisito ajustado: sin música (niveles 0) es una esfera perfecta en
  // cualquier instante; la forma solo cambia con niveles reales.
  it('sin música es una esfera perfecta; con música cambia con el tiempo', () => {
    const d = new OrbDeformer(DETAIL);
    for (const t of [0, 2, 40]) {
      d.apply(t, 0, 0);
      const p = positions(d);
      for (let i = 0; i < p.length; i += 3) expect(Math.hypot(p[i]!, p[i + 1]!, p[i + 2]!)).toBeCloseTo(1, 6);
    }
    d.apply(0, 0.7, 0.7);
    const p0 = positions(d);
    d.apply(2, 0.7, 0.7);
    const p1 = positions(d);
    let changed = 0;
    for (let i = 0; i < p0.length; i++) if (Math.abs(p0[i]! - p1[i]!) > 1e-4) changed++;
    expect(changed).toBeGreaterThan(p0.length * 0.5);
  });

  it('mantiene la forma suave: radios acotados y sin picos entre vecinos', () => {
    const d = new OrbDeformer(16);
    const index = d.geometry.getIndex()!.array;
    for (const t of [0, 7.3, 40, 300]) {
      d.apply(t, 0);
      const p = positions(d);
      const radius = (i: number) => Math.hypot(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
      for (let i = 0; i < p.length / 3; i++) {
        expect(radius(i)).toBeGreaterThan(1 - MAX_DISPLACEMENT);
        expect(radius(i)).toBeLessThan(1 + MAX_DISPLACEMENT);
      }
      // Pendiente entre vértices vecinos (cambio de radio / longitud de la
      // arista): por debajo de 1 (45°) no hay picos agresivos.
      const dirs = d.baseDirections;
      let maxSlope = 0;
      for (let f = 0; f < index.length; f += 3) {
        const a = index[f]!;
        const b = index[f + 1]!;
        const edge = Math.hypot(
          dirs[a * 3]! - dirs[b * 3]!,
          dirs[a * 3 + 1]! - dirs[b * 3 + 1]!,
          dirs[a * 3 + 2]! - dirs[b * 3 + 2]!,
        );
        maxSlope = Math.max(maxSlope, Math.abs(radius(a) - radius(b)) / edge);
      }
      expect(maxSlope).toBeLessThan(1);
    }
  });

  it('sin audio (energía 0) solo hay movimiento ambiental; la energía real lo amplía', () => {
    const silent = orbDisplacement(0.3, 0.5, 0.81, 4, 0);
    expect(orbDisplacement(0.3, 0.5, 0.81, 4, SILENT_AUDIO.energy)).toBe(silent);
    expect(SILENT_AUDIO_INPUT.current.energy).toBe(0);
    expect(orbDisplacement(0.3, 0.5, 0.81, 4, 1)).not.toBe(silent);
  });

  it('las normales son unitarias, finitas e iguales a las de three', () => {
    const d = new OrbDeformer(DETAIL);
    d.apply(5.5, 0);
    const normals = new Float32Array(d.geometry.getAttribute('normal').array as Float32Array);
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!);
      expect(len).toBeCloseTo(1, 5);
    }
    d.geometry.computeVertexNormals();
    const reference = d.geometry.getAttribute('normal').array as Float32Array;
    for (let i = 0; i < normals.length; i++) expect(normals[i]).toBeCloseTo(reference[i]!, 5);
  });

  it('computeSmoothNormals apunta hacia afuera en una esfera sin deformar', () => {
    const g = createOrbGeometry(4);
    const pos = g.getAttribute('position').array as Float32Array;
    const out = new Float32Array(pos.length);
    computeSmoothNormals(pos, g.getIndex()!.array, out);
    for (let i = 0; i < pos.length; i += 3) {
      const dot = out[i]! * pos[i]! + out[i + 1]! * pos[i + 1]! + out[i + 2]! * pos[i + 2]!;
      expect(dot).toBeGreaterThan(0.95);
    }
  });

  it('dispose libera la geometría', () => {
    const d = new OrbDeformer(4);
    let disposed = false;
    d.geometry.addEventListener('dispose', () => {
      disposed = true;
    });
    d.dispose();
    expect(disposed).toBe(true);
  });
});

describe('entrada de audio (para la fase 3)', () => {
  it('clamp01 protege contra valores fuera de rango o NaN', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('smoothTowards depende del tiempo, no de los fotogramas', () => {
    let a = 0;
    for (let k = 0; k < 120; k++) a = smoothTowards(a, 1, 1 / 120, 5, 2); // 1 s a 120 fps
    let b = 0;
    for (let k = 0; k < 30; k++) b = smoothTowards(b, 1, 1 / 30, 5, 2); // 1 s a 30 fps
    expect(a).toBeCloseTo(b, 10);
    expect(a).toBeCloseTo(1 - Math.exp(-5), 10);
  });

  it('sube y baja con velocidades distintas', () => {
    const up = smoothTowards(0, 1, 0.1, 10, 1);
    const down = smoothTowards(1, 0, 0.1, 10, 1);
    expect(up).toBeGreaterThan(1 - down);
  });
});

describe('respuesta al audio (fase 3B)', () => {
  function maxSlopeAndRadius(d: OrbDeformer) {
    const index = d.geometry.getIndex()!.array;
    const p = positions(d);
    const dirs = d.baseDirections;
    const radius = (i: number) => Math.hypot(p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!);
    let maxSlope = 0;
    let maxRadius = 0;
    let sum = 0;
    for (let i = 0; i < p.length / 3; i++) {
      maxRadius = Math.max(maxRadius, radius(i));
      sum += radius(i);
    }
    for (let f = 0; f < index.length; f += 3) {
      for (const [a, b] of [
        [index[f]!, index[f + 1]!],
        [index[f + 1]!, index[f + 2]!],
      ] as const) {
        const edge = Math.hypot(
          dirs[a * 3]! - dirs[b * 3]!,
          dirs[a * 3 + 1]! - dirs[b * 3 + 1]!,
          dirs[a * 3 + 2]! - dirs[b * 3 + 2]!,
        );
        maxSlope = Math.max(maxSlope, Math.abs(radius(a) - radius(b)) / edge);
      }
    }
    return { maxSlope, maxRadius, meanRadius: sum / (p.length / 3) };
  }

  it('con energía y graves al máximo sigue sin picos y dentro del límite fijo', () => {
    const d = new OrbDeformer(16);
    for (const t of [0, 3.1, 7.3, 40, 300]) {
      d.apply(t, 1, 1);
      const { maxSlope, maxRadius } = maxSlopeAndRadius(d);
      expect(maxSlope).toBeLessThan(1);
      expect(maxRadius).toBeLessThan(1 + MAX_DISPLACEMENT);
    }
    // El límite fijo cabe en el encuadre de la cámara (mitad visible ≈ 1,41 a 4,1 de distancia, fov 38°).
    expect(1 + MAX_DISPLACEMENT).toBeLessThan(4.1 * Math.tan((19 * Math.PI) / 180));
  });

  it('los graves inflan la esfera de forma sutil (pulsación) y amplían los pliegues', () => {
    const d = new OrbDeformer(12);
    d.apply(5, 0, 0);
    const quiet = maxSlopeAndRadius(d);
    d.apply(5, 0, 1);
    const bass = maxSlopeAndRadius(d);
    const growth = bass.meanRadius - quiet.meanRadius;
    expect(growth).toBeGreaterThan(0.02);
    expect(growth).toBeLessThanOrEqual(ORB_CONFIG.audio.bassPulse + 0.01);
    expect(bass.maxSlope).toBeGreaterThan(quiet.maxSlope);
  });

  it('con niveles reales no acumula deformación: volver a 0 recupera la forma ambiental', () => {
    const a = new OrbDeformer(DETAIL);
    for (let k = 0; k < 30; k++) a.apply(4, (k % 7) / 7, (k % 5) / 5);
    a.apply(4, 0, 0);
    const b = new OrbDeformer(DETAIL);
    b.apply(4, 0, 0);
    expect(positions(a)).toEqual(positions(b));
  });
});
