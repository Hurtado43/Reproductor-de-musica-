import { clamp01, smoothTowards, type OrbAudioLevels } from './orbAudio';
import { ORB_CONFIG } from './orbGeometry';

/**
 * Movimiento de la esfera: solo la música real la mueve (fase 5, ajustada a
 * petición del usuario).
 *
 * - **En reposo es una esfera perfecta.** La deformación (pliegues, capa de
 *   energía y pulsación de graves) se multiplica por los niveles reales: con
 *   niveles 0 no hay deformación (`orbIntensity` en `orbGeometry.ts`).
 * - **Reproduciendo** (`active === true`: reproducción confirmada por el motor y
 *   datos reales del analizador), los niveles siguen a la señal con el
 *   suavizado de `ORB_AUDIO_SMOOTHING`: la esfera se deforma al ritmo.
 * - **Sin reproducción** (antes de reproducir, pausa, carga, espera, error,
 *   final o sin canciones), los niveles bajan a 0 con la misma caída (5–6/s,
 *   ~1 s) y la esfera **vuelve a su forma original**. Al llegar a 0 se detiene
 *   por completo: no rota ni cambia el brillo. Lo mismo con silencio real,
 *   volumen 0 o mute (la entrada sigue activa, pero con niveles 0).
 * - **Tiempo musical propio** (`musicTime`): el ruido que da la forma no usa el
 *   reloj absoluto; avanza `delta · timeRate · impulso` con el impulso real.
 *   Tras una pausa larga no hay salto.
 * - `prefers-reduced-motion`: esfera quieta; si estaba deformada, vuelve a la
 *   forma original de una vez, sin animación.
 *
 * Sin React, sin three y sin crear objetos en `step`.
 */

/** Suavizado (por segundo) de cada nivel: sube rápido y baja algo más despacio. */
export const ORB_AUDIO_SMOOTHING = {
  energy: { rise: 12, fall: 5 },
  bass: { rise: 18, fall: 6 },
  treble: { rise: 10, fall: 6 },
} as const;

export const ORB_MOTION = {
  /** Segundos de tiempo musical por segundo real con impulso 1. */
  timeRate: 2.5,
  /** Rotación (rad/s) con impulso 1. */
  rotationRate: 0.25,
  /** Pasos más largos se recortan (pestaña oculta, primer fotograma). */
  maxDeltaSeconds: 0.1,
  /** Por debajo, un nivel suavizado se considera 0 (fin del movimiento). */
  restThreshold: 0.01,
  /** Tiempo musical inicial (con niveles 0 la forma es la esfera, sea cual sea). */
  initialTime: ORB_CONFIG.staticTime,
  initialRotationY: 0.6,
} as const;

/** Impulso del movimiento a partir de niveles reales (0 = quieta). */
export function musicDrive(levels: { energy: number; bass: number }): number {
  return clamp01(0.6 * levels.energy + 0.4 * levels.bass);
}

/** Objetivo sin reproducción: niveles 0 (esfera). */
const RESTING: Readonly<OrbAudioLevels> = Object.freeze({ energy: 0, bass: 0, treble: 0, active: false });

export class OrbAnimator {
  /** Tiempo del ruido (solo avanza con señal). */
  musicTime: number = ORB_MOTION.initialTime;
  rotationY: number = ORB_MOTION.initialRotationY;
  /** Niveles suavizados que se dibujan (0 = esfera de reposo). */
  readonly levels = { energy: 0, bass: 0, treble: 0 };

  /** Inclinación del eje, derivada del tiempo musical (no del reloj). */
  get tilt(): number {
    const { wobble, wobbleSpeed } = ORB_CONFIG.rotation;
    return Math.sin(this.musicTime * wobbleSpeed * Math.PI * 2) * wobble;
  }

  /** `true` si la forma es la esfera de reposo (todos los niveles en 0). */
  get atRest(): boolean {
    const { energy, bass, treble } = this.levels;
    return energy === 0 && bass === 0 && treble === 0;
  }

  /**
   * Avanza un fotograma.
   * @returns `true` si cambió algo y hay que volver a deformar la malla.
   */
  step(deltaSeconds: number, input: Readonly<OrbAudioLevels>, reducedMotion: boolean): boolean {
    if (reducedMotion) {
      // Sin animación: si estaba deformada, vuelve a la esfera de una vez.
      if (this.atRest) return false;
      this.levels.energy = 0;
      this.levels.bass = 0;
      this.levels.treble = 0;
      return true;
    }
    // Sin reproducción confirmada: objetivo 0 (vuelta suave a la esfera). Ya en
    // reposo, no se hace nada: la esfera queda quieta.
    if (!input.active && this.atRest) return false;
    const target = input.active ? input : RESTING;
    const dt = Math.min(Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0), ORB_MOTION.maxDeltaSeconds);
    if (dt === 0) return false;

    const levels = this.levels;
    const before = levels.energy + levels.bass + levels.treble;
    const { energy: se, bass: sb, treble: st } = ORB_AUDIO_SMOOTHING;
    levels.energy = this.#settle(smoothTowards(levels.energy, clamp01(target.energy), dt, se.rise, se.fall));
    levels.bass = this.#settle(smoothTowards(levels.bass, clamp01(target.bass), dt, sb.rise, sb.fall));
    levels.treble = this.#settle(smoothTowards(levels.treble, clamp01(target.treble), dt, st.rise, st.fall));

    const drive = musicDrive(levels);
    if (drive > 0) {
      this.musicTime += dt * ORB_MOTION.timeRate * drive;
      this.rotationY += dt * ORB_MOTION.rotationRate * drive;
    }
    const after = levels.energy + levels.bass + levels.treble;
    return drive > 0 || after !== before;
  }

  #settle(value: number): number {
    return value < ORB_MOTION.restThreshold ? 0 : value;
  }
}
