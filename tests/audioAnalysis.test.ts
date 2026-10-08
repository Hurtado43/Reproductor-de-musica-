import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CONFIG,
  AudioLevelAnalyzer,
  BAND_POWER_TO_RMS_DB,
  amplitudeToDb,
  bandLevelDb,
  bandToBinRange,
  computeRms,
  normalizeDb,
  type AnalyserLike,
  type AudioLevels,
} from '../src/features/player/audio/audioAnalysis';

/*
 * Análisis de niveles (funciones puras). Para las bandas se usa un
 * AnalyserNode SIMULADO que implementa el algoritmo de la especificación de
 * Web Audio (ventana Blackman α = 0,16, DFT con normalización 1/N y dB), sin
 * suavizado, igual que el nodo real configurado con smoothingTimeConstant = 0.
 * No es el analizador del navegador: el real se midió aparte (docs/progreso.md).
 */

function sine(frequencyHz: number, amplitude: number, sampleRate: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate);
  return out;
}

/** Espectro en dB según la especificación de `AnalyserNode` (sin suavizado). */
function specSpectrumDb(samples: Float32Array): Float32Array {
  const n = samples.length;
  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
    windowed[i] = samples[i]! * w;
  }
  const out = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * k * i) / n;
      re += windowed[i]! * Math.cos(angle);
      im -= windowed[i]! * Math.sin(angle);
    }
    const magnitude = Math.hypot(re, im) / n;
    out[k] = magnitude > 0 ? 20 * Math.log10(magnitude) : -Infinity;
  }
  return out;
}

/** Analizador SIMULADO con datos fijos (calculados con la especificación). */
function specAnalyser(samples: Float32Array): AnalyserLike & { arrays: Set<Float32Array> } {
  const spectrum = specSpectrumDb(samples);
  const arrays = new Set<Float32Array>();
  return {
    fftSize: samples.length,
    frequencyBinCount: samples.length / 2,
    arrays,
    getFloatTimeDomainData(array) {
      arrays.add(array);
      array.set(samples);
    },
    getFloatFrequencyData(array) {
      arrays.add(array);
      array.set(spectrum);
    },
  };
}

const levels = (): AudioLevels => ({ energy: -1, bass: -1, treble: -1 });

describe('RMS', () => {
  it('silencio y arreglo vacío dan 0', () => {
    expect(computeRms(new Float32Array(2048))).toBe(0);
    expect(computeRms(new Float32Array(0))).toBe(0);
  });

  it('señales conocidas: continua, cuadrada y senoidal', () => {
    expect(computeRms(new Float32Array(1000).fill(0.5))).toBeCloseTo(0.5, 6);
    const square = Float32Array.from({ length: 1000 }, (_, i) => (i % 2 ? 0.25 : -0.25));
    expect(computeRms(square)).toBeCloseTo(0.25, 6);
    // Seno de amplitud A con ciclos completos: A / √2.
    expect(computeRms(sine(1000, 0.8, 48000, 4800))).toBeCloseTo(0.8 / Math.SQRT2, 4);
  });

  it('ignora valores no finitos sin producir NaN', () => {
    const data = Float32Array.from([0.5, Number.NaN, -0.5, Infinity, -Infinity]);
    expect(computeRms(data)).toBeCloseTo(0.5, 6);
    expect(computeRms(Float32Array.from([Number.NaN, Number.NaN]))).toBe(0);
  });
});

describe('normalización en dB', () => {
  const range = { floorDb: -50, ceilingDb: -10 };

  it('lleva el rango a [0, 1] y limita fuera de él', () => {
    expect(normalizeDb(-50, range)).toBe(0);
    expect(normalizeDb(-30, range)).toBeCloseTo(0.5);
    expect(normalizeDb(-10, range)).toBe(1);
    expect(normalizeDb(-80, range)).toBe(0);
    expect(normalizeDb(6, range)).toBe(1);
  });

  it('silencio, NaN y rangos inválidos dan 0', () => {
    expect(normalizeDb(-Infinity, range)).toBe(0);
    expect(normalizeDb(Number.NaN, range)).toBe(0);
    expect(normalizeDb(Infinity, range)).toBe(0);
    expect(normalizeDb(-20, { floorDb: -10, ceilingDb: -10 })).toBe(0);
    expect(amplitudeToDb(0)).toBe(-Infinity);
    expect(amplitudeToDb(Number.NaN)).toBe(-Infinity);
    expect(amplitudeToDb(1)).toBe(0);
  });

  it('conserva la diferencia entre pasajes suaves y fuertes (no satura la música típica)', () => {
    const r = ANALYSIS_CONFIG.ranges.energy;
    const loudMaster = normalizeDb(-10, r); // máster fuerte
    const normal = normalizeDb(-18, r);
    const soft = normalizeDb(-32, r);
    expect(loudMaster).toBeLessThan(1);
    expect(loudMaster - normal).toBeGreaterThan(0.15);
    expect(normal - soft).toBeGreaterThan(0.25);
    expect(soft).toBeGreaterThan(0.2);
  });
});

describe('bandas en Hz → índices de bin', () => {
  const bass = ANALYSIS_CONFIG.bands.bass;
  const treble = ANALYSIS_CONFIG.bands.treble;

  it('48 kHz y 44,1 kHz con fftSize 2048', () => {
    // 48 000 / 2048 = 23,44 Hz por bin.
    expect(bandToBinRange(bass, 48000, 2048)).toEqual({ start: 2, end: 10 });
    expect(bandToBinRange(treble, 48000, 2048)).toEqual({ start: 86, end: 341 });
    // 44 100 / 2048 = 21,53 Hz por bin.
    expect(bandToBinRange(bass, 44100, 2048)).toEqual({ start: 2, end: 11 });
    expect(bandToBinRange(treble, 44100, 2048)).toEqual({ start: 93, end: 371 });
  });

  it('cada bin incluido tiene su centro dentro de la banda', () => {
    for (const sampleRate of [8000, 22050, 44100, 48000, 96000]) {
      for (const band of [bass, treble]) {
        const range = bandToBinRange(band, sampleRate, 2048);
        if (!range) continue;
        const binHz = sampleRate / 2048;
        expect(range.start * binHz).toBeGreaterThanOrEqual(band.minHz);
        expect(range.end * binHz).toBeLessThanOrEqual(Math.min(band.maxHz, sampleRate / 2));
      }
    }
  });

  it('limita a Nyquist y devuelve null si la banda no está disponible', () => {
    // 8 kHz: Nyquist 4 kHz → agudos 2–4 kHz (sin el bin de Nyquist).
    expect(bandToBinRange(treble, 8000, 2048)).toEqual({ start: 512, end: 1023 });
    // 3 kHz: Nyquist 1,5 kHz < 2 kHz → banda vacía.
    expect(bandToBinRange(treble, 3000, 2048)).toBeNull();
    // Banda más estrecha que un bin, sin ningún centro dentro.
    expect(bandToBinRange({ minHz: 30, maxHz: 40 }, 48000, 2048)).toBeNull();
    // Parámetros no válidos.
    expect(bandToBinRange(bass, 0, 2048)).toBeNull();
    expect(bandToBinRange(bass, Number.NaN, 2048)).toBeNull();
    expect(bandToBinRange({ minHz: 300, maxHz: 100 }, 48000, 2048)).toBeNull();
  });

  it('una banda vacía o en silencio da −Infinity, nunca NaN', () => {
    const silent = new Float32Array(1024).fill(-Infinity);
    expect(bandLevelDb(silent, { start: 2, end: 10 })).toBe(-Infinity);
    expect(bandLevelDb(silent, null)).toBe(-Infinity);
    const withNaN = new Float32Array(1024).fill(Number.NaN);
    expect(bandLevelDb(withNaN, { start: 2, end: 10 })).toBe(-Infinity);
  });
});

describe('calibración con el analizador de la especificación (simulado)', () => {
  it('la corrección de la ventana Blackman es ≈ +8,17 dB', () => {
    expect(BAND_POWER_TO_RMS_DB).toBeCloseTo(8.17, 2);
  });

  it('un tono dentro de la banda se lee como su RMS en dBFS', () => {
    for (const sampleRate of [44100, 48000]) {
      const tone = sine(100, 0.3, sampleRate, 2048);
      const spectrum = specSpectrumDb(tone);
      const range = bandToBinRange(ANALYSIS_CONFIG.bands.bass, sampleRate, 2048);
      const expected = amplitudeToDb(0.3 / Math.SQRT2); // −13,5 dBFS
      expect(bandLevelDb(spectrum, range)).toBeCloseTo(expected, 0);
    }
  });

  it('graves y agudos responden a tonos distintos con distintos sampleRate', () => {
    for (const sampleRate of [22050, 44100, 48000, 96000]) {
      const analyzer = new AudioLevelAnalyzer();
      const low = analyzer.measure(specAnalyser(sine(80, 0.3, sampleRate, 2048)), sampleRate, levels());
      const lowCopy = { ...low };
      const high = analyzer.measure(specAnalyser(sine(4000, 0.3, sampleRate, 2048)), sampleRate, levels());
      expect(lowCopy.bass).toBeGreaterThan(0.6);
      expect(lowCopy.treble).toBeLessThan(0.15);
      expect(high.treble).toBeGreaterThan(0.6);
      expect(high.bass).toBeLessThan(0.15);
      // El mismo nivel RMS da la misma energía global.
      expect(high.energy).toBeCloseTo(lowCopy.energy, 1);
    }
  });

  it('un tono de 1 kHz (entre las bandas) da energía pero graves y agudos bajos', () => {
    const result = new AudioLevelAnalyzer().measure(
      specAnalyser(sine(1000, 0.3, 48000, 2048)),
      48000,
      levels(),
    );
    expect(result.energy).toBeGreaterThan(0.5);
    expect(result.bass).toBeLessThan(0.1);
    expect(result.treble).toBeLessThan(0.1);
  });

  it('más volumen → niveles mayores; silencio → todo 0', () => {
    const analyzer = new AudioLevelAnalyzer();
    const loud = { ...analyzer.measure(specAnalyser(sine(80, 0.5, 48000, 2048)), 48000, levels()) };
    const soft = { ...analyzer.measure(specAnalyser(sine(80, 0.05, 48000, 2048)), 48000, levels()) };
    expect(loud.energy).toBeGreaterThan(soft.energy + 0.3);
    expect(loud.bass).toBeGreaterThan(soft.bass + 0.3);
    const silent = analyzer.measure(specAnalyser(new Float32Array(2048)), 48000, levels());
    expect(silent).toEqual({ energy: 0, bass: 0, treble: 0 });
  });

  it('la banda de agudos fuera de Nyquist da 0 y valores finitos', () => {
    const result = new AudioLevelAnalyzer().measure(
      specAnalyser(sine(400, 0.3, 3000, 2048)),
      3000,
      levels(),
    );
    expect(result.treble).toBe(0);
    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('AudioLevelAnalyzer', () => {
  it('reutiliza los buffers y el objeto de salida entre fotogramas', () => {
    const analyser = specAnalyser(sine(80, 0.3, 48000, 2048));
    const analyzer = new AudioLevelAnalyzer();
    const out = levels();
    for (let i = 0; i < 20; i++) expect(analyzer.measure(analyser, 48000, out)).toBe(out);
    expect(analyser.arrays.size).toBe(2); // un buffer temporal y uno de frecuencias
    expect(analyzer.buffers.time.length).toBe(2048);
    expect(analyzer.buffers.freq.length).toBe(1024);
  });

  it('valores extremos o corruptos siempre dan niveles finitos en [0, 1]', () => {
    const cases: Array<[number, number]> = [
      [Infinity, Infinity],
      [Number.NaN, Number.NaN],
      [10, 40], // por encima de la plena escala
      [-1e-9, -300],
    ];
    for (const [sample, db] of cases) {
      const analyser: AnalyserLike = {
        fftSize: 2048,
        frequencyBinCount: 1024,
        getFloatTimeDomainData: (array) => array.fill(sample),
        getFloatFrequencyData: (array) => array.fill(db),
      };
      const result = new AudioLevelAnalyzer().measure(analyser, 48000, levels());
      for (const value of Object.values(result)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
