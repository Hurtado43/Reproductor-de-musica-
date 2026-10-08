/**
 * Entrada de audio de la esfera.
 *
 * FASE 3B: `AudioLevelsMeter` (src/features/player/audio) lee el `AnalyserNode`
 * de la ruta de salida real y escribe aquí, una vez por fotograma y sin estado
 * de React, niveles normalizados a [0, 1]:
 *   - `energy`: RMS de las muestras temporales.
 *   - `bass` / `treble`: energía de las bandas 40–250 Hz y 2–8 kHz.
 * (Fórmulas y normalización en `audio/audioAnalysis.ts`.)
 * En pausa, al terminar, con error, sin canción o al cambiar de fuente, los
 * niveles valen 0 y `active` es `false`: la esfera vuelve a su forma redonda y
 * se detiene (fase 5). No se
 * inventan amplitudes ni golpes.
 *
 * La esfera suaviza estos valores en el tiempo (`OrbAnimator` en `orbMotion.ts`,
 * único suavizado de la cadena) y los usa para la deformación y el brillo.
 */
export interface OrbAudioLevels {
  /** Energía global del sonido que suena, en [0, 1]. 0 = silencio o sin audio. */
  energy: number;
  /** Energía de graves, en [0, 1]. */
  bass: number;
  /** Energía de agudos, en [0, 1]. */
  treble: number;
  /**
   * `true` solo con reproducción confirmada por el motor y datos reales del
   * analizador (fase 5). Con `false` la esfera vuelve a la forma redonda y se detiene.
   */
  active: boolean;
}

/** Sin analizador: la energía musical es cero y la esfera no se mueve. */
export const SILENT_AUDIO: Readonly<OrbAudioLevels> = Object.freeze({
  energy: 0,
  bass: 0,
  treble: 0,
  active: false,
});

/** Referencia estable cuyo contenido actualiza el medidor de niveles. */
export interface OrbAudioInput {
  readonly current: Readonly<OrbAudioLevels>;
}

/** Entrada por defecto (sin reproductor conectado): siempre en silencio. */
export const SILENT_AUDIO_INPUT: OrbAudioInput = { current: SILENT_AUDIO };

/** Limita a [0, 1] (protege contra NaN o valores fuera de rango del analizador). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Suavizado exponencial dependiente del tiempo (no de los fotogramas).
 * Sube con `riseRate` y baja con `fallRate` (por segundo), así que da el mismo
 * resultado a 30 o a 120 fps.
 */
export function smoothTowards(
  current: number,
  target: number,
  deltaSeconds: number,
  riseRate: number,
  fallRate: number,
): number {
  const rate = target > current ? riseRate : fallRate;
  const factor = 1 - Math.exp(-rate * Math.max(0, deltaSeconds));
  return current + (target - current) * factor;
}
