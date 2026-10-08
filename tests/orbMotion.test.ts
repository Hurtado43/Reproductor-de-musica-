import { describe, expect, it } from 'vitest';
import type { OrbAudioLevels } from '../src/features/player/visualizer/orbAudio';
import { OrbDeformer } from '../src/features/player/visualizer/orbGeometry';
import { ORB_MOTION, OrbAnimator, musicDrive } from '../src/features/player/visualizer/orbMotion';

/*
 * Movimiento de la esfera (fase 5) sin WebGL: `OrbAnimator` con niveles
 * construidos en la prueba y el deformador real. El render real se verificó en
 * el navegador (docs/progreso.md). Requisito: no hay movimiento ambiental; en
 * reposo es una esfera redonda y solo la música real la deforma.
 */

const FRAME = 1 / 60;
const input = (energy: number, bass: number, treble: number, active = true): OrbAudioLevels => ({
  energy,
  bass,
  treble,
  active,
});
const IDLE = input(0, 0, 0, false);

function run(animator: OrbAnimator, levels: OrbAudioLevels, seconds: number, reduced = false) {
  let changed = 0;
  for (let t = 0; t < seconds; t += FRAME) if (animator.step(FRAME, levels, reduced)) changed++;
  return changed;
}

/** Máxima diferencia entre el radio de cada vértice y 1 (0 = esfera perfecta). */
function maxRadiusError(p: Float32Array): number {
  let max = 0;
  for (let i = 0; i < p.length; i += 3) max = Math.max(max, Math.abs(Math.hypot(p[i]!, p[i + 1]!, p[i + 2]!) - 1));
  return max;
}

function shape(animator: OrbAnimator, deformer: OrbDeformer) {
  deformer.apply(animator.musicTime, animator.levels.energy, animator.levels.bass);
  return {
    positions: new Float32Array(deformer.geometry.getAttribute('position').array as Float32Array),
    rotation: [animator.tilt, animator.rotationY],
    levels: { ...animator.levels },
  };
}

describe('esfera inmóvil sin reproducción confirmada', () => {
  it('sin entrada activa (inicio, pausa, final, error, sin canciones, carga) no cambia nada', () => {
    const animator = new OrbAnimator();
    const start = { time: animator.musicTime, rotation: animator.rotationY };
    // Durante 30 s "de reloj" sin reproducción confirmada.
    expect(run(animator, IDLE, 30)).toBe(0);
    expect(animator.musicTime).toBe(start.time);
    expect(animator.rotationY).toBe(start.rotation);
    expect(animator.levels).toEqual({ energy: 0, bass: 0, treble: 0 });
  });

  it('niveles altos pero sin reproducción confirmada (pulsar Reproducir no basta): sigue quieta', () => {
    const animator = new OrbAnimator();
    expect(run(animator, input(1, 1, 1, false), 2)).toBe(0);
    expect(animator.musicTime).toBe(ORB_MOTION.initialTime);
  });

  // Requisito ajustado tras la fase 5: en reposo la esfera es redonda y, al
  // pausar, vuelve a esa forma (antes se congelaba la forma deformada).
  it('al pausar vuelve suavemente a la esfera original (~1 s) y después queda quieta', () => {
    const animator = new OrbAnimator();
    const deformer = new OrbDeformer(6);
    run(animator, input(0.8, 0.7, 0.6), 1.5);
    expect(maxRadiusError(shape(animator, deformer).positions)).toBeGreaterThan(0.02); // deformada
    // Pausa: el medidor escribe 0 y `active: false`.
    expect(animator.step(FRAME, IDLE, false)).toBe(true); // empieza a volver (sin salto)
    run(animator, IDLE, 1.5);
    expect(animator.atRest).toBe(true);
    expect(maxRadiusError(shape(animator, deformer).positions)).toBeLessThan(1e-6); // esfera
    const rest = { time: animator.musicTime, rotation: animator.rotationY };
    expect(run(animator, IDLE, 30)).toBe(0); // quieta
    expect(animator.musicTime).toBe(rest.time);
    expect(animator.rotationY).toBe(rest.rotation);
    deformer.dispose();
  });

  it('la vuelta a la esfera es gradual (sin saltos entre fotogramas)', () => {
    const animator = new OrbAnimator();
    run(animator, input(0.9, 0.9, 0.9), 1);
    let previous = animator.levels.energy;
    for (let i = 0; i < 90; i++) {
      animator.step(FRAME, IDLE, false);
      const now = animator.levels.energy;
      expect(previous - now).toBeLessThan(0.1); // a 60 fps, menos de 0,1 por fotograma
      expect(now).toBeLessThanOrEqual(previous);
      previous = now;
    }
  });

  it('reanudar tras una pausa larga continúa sin salto', () => {
    const animator = new OrbAnimator();
    const playing = input(0.6, 0.5, 0.4);
    run(animator, playing, 1);
    run(animator, IDLE, 600); // 10 minutos en pausa: vuelve a la esfera y se detiene
    const paused = animator.musicTime;
    expect(animator.atRest).toBe(true);
    animator.step(5, playing, false); // primer fotograma tras volver a la pestaña: delta recortado
    expect(animator.musicTime - paused).toBeLessThanOrEqual(ORB_MOTION.maxDeltaSeconds * ORB_MOTION.timeRate);
    expect(animator.levels.energy).toBeLessThan(0.6); // crece desde la esfera, sin saltar al nivel final
  });

  it('movimiento reducido: esfera quieta aunque suene música; si estaba deformada, vuelve de una vez', () => {
    const animator = new OrbAnimator();
    expect(run(animator, input(1, 1, 1), 5, true)).toBe(0);
    expect(animator.musicTime).toBe(ORB_MOTION.initialTime);
    run(animator, input(1, 1, 1), 1); // deformada sin movimiento reducido
    expect(animator.step(FRAME, input(1, 1, 1), true)).toBe(true); // vuelve en un solo paso
    expect(animator.atRest).toBe(true);
    expect(run(animator, input(1, 1, 1), 5, true)).toBe(0);
  });

  it('en reposo inicial es una esfera perfecta', () => {
    const animator = new OrbAnimator();
    const deformer = new OrbDeformer(6);
    expect(maxRadiusError(shape(animator, deformer).positions)).toBeLessThan(1e-6);
    deformer.dispose();
  });
});

describe('movimiento gobernado por la señal real', () => {
  it('con señal cambian la forma, la rotación y los niveles; más energía, más avance', () => {
    const soft = new OrbAnimator();
    const loud = new OrbAnimator();
    run(soft, input(0.2, 0.1, 0.1), 2);
    run(loud, input(0.9, 0.8, 0.5), 2);
    expect(soft.musicTime).toBeGreaterThan(ORB_MOTION.initialTime);
    expect(loud.musicTime - ORB_MOTION.initialTime).toBeGreaterThan(soft.musicTime - ORB_MOTION.initialTime);
    expect(loud.rotationY).toBeGreaterThan(soft.rotationY);
    expect(loud.levels.treble).toBeGreaterThan(0.4); // reflejos
  });

  it('silencio real, volumen 0 o mute (activa, niveles 0): se detiene tras el suavizado breve', () => {
    const animator = new OrbAnimator();
    run(animator, input(0.9, 0.9, 0.9), 1);
    const silent = input(0, 0, 0, true);
    run(animator, silent, 1); // caída de 5–6/s: por debajo del umbral en menos de 1 s
    expect(animator.levels).toEqual({ energy: 0, bass: 0, treble: 0 });
    const frozen = { time: animator.musicTime, rotation: animator.rotationY };
    expect(run(animator, silent, 30)).toBe(0); // sin animación permanente
    expect(animator.musicTime).toBe(frozen.time);
    expect(animator.rotationY).toBe(frozen.rotation);
  });

  it('el impulso solo sale de energía y graves y queda en [0, 1]', () => {
    expect(musicDrive({ energy: 0, bass: 0 })).toBe(0);
    expect(musicDrive({ energy: 1, bass: 1 })).toBe(1);
    expect(musicDrive({ energy: Number.NaN, bass: 0.5 })).toBe(0);
  });

  it('no acumula deformación: la forma depende solo del estado, no del número de pasos', () => {
    const animator = new OrbAnimator();
    const d1 = new OrbDeformer(6);
    const d2 = new OrbDeformer(6);
    run(animator, input(0.7, 0.6, 0.3), 1);
    for (let i = 0; i < 40; i++) shape(animator, d1);
    const once = shape(animator, d2);
    expect(shape(animator, d1).positions).toEqual(once.positions);
    d1.dispose();
    d2.dispose();
  });
});
