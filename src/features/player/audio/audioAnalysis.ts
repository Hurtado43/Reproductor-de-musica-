/**
 * Análisis del audio real (capa cliente, sin React, sin DOM y sin geometría).
 *
 * Convierte lo que entrega un `AnalyserNode` en tres niveles en [0, 1]:
 *   - `energy`: RMS de las muestras temporales (`getFloatTimeDomainData`).
 *   - `bass`:   energía de la banda 40–250 Hz del espectro.
 *   - `treble`: energía de la banda 2 000–8 000 Hz del espectro.
 *
 * Todo se expresa en dBFS (0 dB = onda a plena escala) y se normaliza con un
 * rango FIJO en dB para cada nivel. No hay control automático de ganancia: un
 * pasaje suave da valores bajos y uno fuerte, altos; el silencio da 0.
 *
 * No hay suavizado aquí: el analizador usa `smoothingTimeConstant = 0` y el
 * único suavizado temporal lo aplica la esfera (`smoothTowards` en `OrbMesh`).
 */

export interface AudioLevels {
  energy: number;
  bass: number;
  treble: number;
}

export interface FrequencyBand {
  readonly minHz: number;
  readonly maxHz: number;
}

/** Rango en dBFS que se lleva a [0, 1]: `floorDb` → 0 y `ceilingDb` → 1. */
export interface DbRange {
  readonly floorDb: number;
  readonly ceilingDb: number;
}

export const ANALYSIS_CONFIG = {
  /** 2048 muestras: ~43 ms a 48 kHz y bins de 23,4 Hz (el bin 2 ya es 47 Hz). */
  fftSize: 2048,
  bands: {
    bass: { minHz: 40, maxHz: 250 },
    treble: { minHz: 2000, maxHz: 8000 },
  },
  /**
   * Rangos de normalización (dBFS). Elegidos para música comercial típica:
   * el RMS global de un máster fuerte ronda −14…−8 dBFS y el de un pasaje
   * suave −30…−40 dBFS; los graves concentran más energía que los agudos.
   */
  ranges: {
    energy: { floorDb: -50, ceilingDb: -8 },
    bass: { floorDb: -52, ceilingDb: -12 },
    treble: { floorDb: -64, ceilingDb: -24 },
  },
} as const;

/**
 * Corrección de la ventana del `AnalyserNode` (Blackman, α = 0,16, con
 * normalización 1/N de la especificación de Web Audio). La suma de la
 * potencia de los bins de una banda equivale a `RMS² · mean(w²) / 2`, así que
 * se suma `−10·log10(mean(w²) / 2)` ≈ +8,17 dB para leer la banda como RMS en dBFS.
 */
const BLACKMAN_MEAN_SQUARE = 0.42 ** 2 + 0.5 ** 2 / 2 + 0.08 ** 2 / 2;
export const BAND_POWER_TO_RMS_DB = -10 * Math.log10(BLACKMAN_MEAN_SQUARE / 2);

/** Lleva `db` a [0, 1] según `range`. `-Infinity`, NaN o rangos inválidos dan 0. */
export function normalizeDb(db: number, range: DbRange): number {
  const span = range.ceilingDb - range.floorDb;
  if (!Number.isFinite(db) || !(span > 0)) return 0;
  const value = (db - range.floorDb) / span;
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/** 20·log10(amplitud); 0 o valores no válidos dan `-Infinity`. */
export function amplitudeToDb(amplitude: number): number {
  return Number.isFinite(amplitude) && amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
}

/** RMS de las muestras. Ignora valores no finitos; sin muestras válidas, 0. */
export function computeRms(samples: ArrayLike<number>): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    if (!Number.isFinite(s)) continue;
    sum += s * s;
    count++;
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
}

/** Bins `[start, end]` (ambos incluidos) de una banda; `null` si queda vacía. */
export interface BinRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Convierte una banda en Hz en índices de bin con el `sampleRate` y el
 * `fftSize` reales. El bin `k` está centrado en `k · sampleRate / fftSize`.
 * Se toman los bins cuyo centro cae dentro de la banda, sin el bin 0 (DC) y
 * por debajo de Nyquist (`frequencyBinCount = fftSize / 2`).
 * Devuelve `null` si la banda queda fuera de las frecuencias disponibles o no
 * contiene ningún bin.
 */
export function bandToBinRange(band: FrequencyBand, sampleRate: number, fftSize: number): BinRange | null {
  if (!(sampleRate > 0) || !(fftSize >= 2) || !Number.isFinite(sampleRate) || !Number.isFinite(fftSize)) {
    return null;
  }
  if (!(band.maxHz >= band.minHz)) return null;
  const binHz = sampleRate / fftSize;
  const lastBin = Math.floor(fftSize / 2) - 1;
  const start = Math.max(1, Math.ceil(band.minHz / binHz));
  const end = Math.min(lastBin, Math.floor(band.maxHz / binHz));
  return start <= end ? { start, end } : null;
}

/**
 * Nivel de una banda en dBFS (equivalente RMS) a partir de los dB por bin de
 * `getFloatFrequencyData`. Suma la potencia de los bins (no el promedio, así
 * el resultado no depende del ancho de la banda) y aplica la corrección de la
 * ventana. Bins no finitos (−Infinity en silencio, NaN) no aportan potencia.
 */
export function bandLevelDb(frequencyDb: ArrayLike<number>, range: BinRange | null): number {
  if (range === null) return -Infinity;
  let power = 0;
  const end = Math.min(range.end, frequencyDb.length - 1);
  for (let k = range.start; k <= end; k++) {
    const db = frequencyDb[k]!;
    if (Number.isFinite(db)) power += 10 ** (db / 10);
  }
  return power > 0 ? 10 * Math.log10(power) + BAND_POWER_TO_RMS_DB : -Infinity;
}

/** Lo que el analizador usa de `AnalyserNode` (se simula en las pruebas). */
export interface AnalyserLike {
  readonly fftSize: number;
  readonly frequencyBinCount: number;
  getFloatTimeDomainData(array: Float32Array<ArrayBuffer>): void;
  getFloatFrequencyData(array: Float32Array<ArrayBuffer>): void;
}

/**
 * Lee un `AnalyserNode` y calcula los niveles normalizados.
 *
 * - Los buffers se crean una vez (por `fftSize`) y se reutilizan: `measure`
 *   no crea arreglos ni objetos por fotograma; escribe en el objeto `out`.
 * - Los rangos de bins se recalculan solo si cambian `sampleRate` o `fftSize`.
 */
export class AudioLevelAnalyzer {
  #time: Float32Array<ArrayBuffer> = new Float32Array(0);
  #freq: Float32Array<ArrayBuffer> = new Float32Array(0);
  #sampleRate = 0;
  #fftSize = 0;
  #bass: BinRange | null = null;
  #treble: BinRange | null = null;

  /** Mide y escribe en `out`. Devuelve `out`. */
  measure(analyser: AnalyserLike, sampleRate: number, out: AudioLevels): AudioLevels {
    this.#prepare(analyser, sampleRate);
    analyser.getFloatTimeDomainData(this.#time);
    analyser.getFloatFrequencyData(this.#freq);
    const { ranges } = ANALYSIS_CONFIG;
    out.energy = normalizeDb(amplitudeToDb(computeRms(this.#time)), ranges.energy);
    out.bass = normalizeDb(bandLevelDb(this.#freq, this.#bass), ranges.bass);
    out.treble = normalizeDb(bandLevelDb(this.#freq, this.#treble), ranges.treble);
    return out;
  }

  /** Buffers actuales (para comprobar en pruebas que se reutilizan). */
  get buffers(): { readonly time: Float32Array; readonly freq: Float32Array } {
    return { time: this.#time, freq: this.#freq };
  }

  #prepare(analyser: AnalyserLike, sampleRate: number): void {
    const fftSize = analyser.fftSize;
    if (this.#time.length !== fftSize) this.#time = new Float32Array(fftSize);
    if (this.#freq.length !== analyser.frequencyBinCount) {
      this.#freq = new Float32Array(analyser.frequencyBinCount);
    }
    if (sampleRate !== this.#sampleRate || fftSize !== this.#fftSize) {
      this.#sampleRate = sampleRate;
      this.#fftSize = fftSize;
      this.#bass = bandToBinRange(ANALYSIS_CONFIG.bands.bass, sampleRate, fftSize);
      this.#treble = bandToBinRange(ANALYSIS_CONFIG.bands.treble, sampleRate, fftSize);
    }
  }
}

/** Escribe ceros (silencio) en `out`. */
export function zeroLevels(out: AudioLevels): AudioLevels {
  out.energy = 0;
  out.bass = 0;
  out.treble = 0;
  return out;
}
