import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../src/features/player/audio/AudioEngine';
import { AudioLevelsMeter } from '../src/features/player/audio/AudioLevelsMeter';
import { fakeAudioContextFactory, toneSignal } from './fakes/fakeAudioContext';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Medidor de niveles con el motor real y un elemento, un AudioContext y un
 * AnalyserNode SIMULADOS. El analizador simulado devuelve la señal que fija
 * la prueba, atenuada por volume/muted del elemento como en Chromium (medido
 * en el navegador, docs/progreso.md). requestAnimationFrame es manual.
 */

const file = (name: string) => new File([new Uint8Array(16)], name, { type: 'audio/mpeg' });

function manualFrames() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    pending,
    scheduler: {
      requestAnimationFrame: (callback: () => void) => {
        const id = next++;
        pending.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id: unknown) => {
        pending.delete(id as number);
      },
    },
    /** Ejecuta un fotograma (los callbacks programados hasta ahora). */
    run() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

async function setup(sampleRate = 48000) {
  const contexts = fakeAudioContextFactory({ autoResume: true, sampleRate });
  const fake = fakePlaybackEnvironment({ createAudioContext: contexts.create });
  const engine = new AudioEngine(fake.env);
  const frames = manualFrames();
  const meter = new AudioLevelsMeter(engine, frames.scheduler);
  const disconnect = meter.connect();
  const levels = meter.input.current;

  const playSong = async (id: string) => {
    engine.load(id, file(`${id}.mp3`), { autoplay: true });
    await flush();
    fake.media().resolvePlay();
    await flush();
  };
  /** Avanza el reloj del contexto más allá de la ventana descartada y dibuja un fotograma. */
  const frameAfterWindow = () => {
    contexts.last().advance(0.05);
    frames.run();
  };
  return { engine, meter, frames, levels, contexts, fake, disconnect, playSong, frameAfterWindow };
}

describe('AudioLevelsMeter', () => {
  it('sin reproducir no hay bucle y los niveles valen 0', async () => {
    const { frames, levels, engine } = await setup();
    expect(frames.pending.size).toBe(0);
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    engine.load('a', file('a.mp3'), { autoplay: false });
    expect(frames.pending.size).toBe(0);
  });

  it('reproduciendo: un solo bucle que escribe niveles reales en la entrada estable', async () => {
    const { frames, levels, contexts, playSong, frameAfterWindow, meter } = await setup();
    await playSong('a');
    contexts.last().signal = toneSignal(80, 0.3);
    expect(frames.pending.size).toBe(1);
    frameAfterWindow();
    expect(levels.energy).toBeGreaterThan(0.5);
    expect(levels.bass).toBeGreaterThan(0.6);
    expect(levels.treble).toBe(0);
    expect(meter.input.current).toBe(levels); // misma referencia
    expect(frames.pending.size).toBe(1); // nunca más de un fotograma programado
    for (let i = 0; i < 10; i++) frames.run();
    expect(frames.pending.size).toBe(1);
  });

  it('un pasaje silencioso mientras "Reproduciendo" da 0', async () => {
    const { levels, contexts, playSong, frameAfterWindow, engine } = await setup();
    await playSong('a');
    contexts.last().signal = { time: new Float32Array(2048), freqDb: new Float32Array(1024).fill(-Infinity) };
    frameAfterWindow();
    expect(engine.getSnapshot().status).toBe('playing');
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: true }); // suena: datos reales que valen 0
  });

  it('pausa, final y error: niveles a 0 y bucle cancelado', async () => {
    const { frames, levels, contexts, playSong, frameAfterWindow, engine, fake } = await setup();
    await playSong('a');
    contexts.last().signal = toneSignal(4000, 0.3);
    frameAfterWindow();
    expect(levels.treble).toBeGreaterThan(0.5);

    engine.pause();
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    expect(frames.pending.size).toBe(0);

    engine.play();
    await flush();
    fake.media().resolvePlay();
    await flush();
    frameAfterWindow();
    expect(levels.treble).toBeGreaterThan(0.5);
    fake.media().finish();
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    expect(frames.pending.size).toBe(0);

    await playSong('b');
    frameAfterWindow();
    expect(levels.treble).toBeGreaterThan(0.5);
    fake.media().error = { code: 3 };
    fake.media().emit('error');
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    expect(frames.pending.size).toBe(0);
  });

  it('cambio de fuente: 0 de inmediato y sin señal antigua en la ventana del analizador', async () => {
    const { levels, contexts, playSong, frames, engine, fake } = await setup();
    await playSong('a');
    const ctx = contexts.last();
    ctx.signal = toneSignal(80, 0.5);
    ctx.advance(0.05);
    frames.run();
    expect(levels.bass).toBeGreaterThan(0.5);

    engine.load('b', file('b.mp3'), { autoplay: true }); // Siguiente
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    await flush();
    // El analizador simulado aún devuelve la señal anterior (como el buffer
    // real de ~43 ms): mientras no pase la ventana se descarta.
    fake.media().resolvePlay();
    await flush();
    frames.run(); // mismo instante del contexto: dentro de la ventana
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    ctx.advance(0.05);
    frames.run();
    expect(levels.bass).toBeGreaterThan(0.5); // ahora sí, datos nuevos
  });

  it('la ventana descartada usa fftSize / sampleRate reales (44,1 y 48 kHz)', async () => {
    for (const [sampleRate, windowSeconds] of [
      [44100, 2048 / 44100], // 46,4 ms
      [48000, 2048 / 48000], // 42,7 ms
    ] as const) {
      const { levels, contexts, playSong, frames } = await setup(sampleRate);
      await playSong('a');
      const ctx = contexts.last();
      ctx.signal = toneSignal(80, 0.3, sampleRate);
      ctx.advance(windowSeconds - 0.001); // aún dentro de la ventana
      frames.run();
      expect(levels.bass).toBe(0);
      ctx.advance(0.002); // justo después
      frames.run();
      expect(levels.bass).toBeGreaterThan(0.5);
    }
  });

  it('fase 5: `active` solo con reproducción confirmada y datos reales (pulsar Reproducir no basta)', async () => {
    const { levels, contexts, frames, engine, fake } = await setup();
    engine.load('a', file('a.mp3'), { autoplay: true }); // "Cargando…": play() pendiente
    await flush();
    contexts.last().signal = toneSignal(80, 0.3);
    contexts.last().advance(0.1);
    frames.run();
    expect(levels.active).toBe(false);
    fake.media().resolvePlay(); // confirmado
    await flush();
    frames.run(); // dentro de la ventana descartada
    expect(levels.active).toBe(false);
    contexts.last().advance(0.05);
    frames.run();
    expect(levels.active).toBe(true);
    engine.pause();
    expect(levels.active).toBe(false);
  });

  it('descargar (eliminar la única canción) pone los niveles a 0', async () => {
    const { levels, contexts, playSong, frameAfterWindow, engine, frames } = await setup();
    await playSong('a');
    contexts.last().signal = toneSignal(80, 0.3);
    frameAfterWindow();
    engine.unload();
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
    expect(frames.pending.size).toBe(0);
  });

  it('volumen y silencio: la reacción sigue al nivel de salida, sin aplicar el volumen dos veces', async () => {
    const { levels, contexts, playSong, frameAfterWindow, engine } = await setup();
    await playSong('a');
    contexts.last().signal = toneSignal(80, 0.4);
    frameAfterWindow();
    const full = { ...levels };

    engine.setVolume(0.5);
    frameAfterWindow();
    const half = { ...levels };
    // −6 dB en la señal → la energía baja 6 / 42 del rango (una sola atenuación).
    const step = 20 * Math.log10(0.5) / (-8 - -50);
    expect(half.energy).toBeCloseTo(full.energy + step, 2);
    expect(half.energy).toBeLessThan(full.energy);

    engine.setVolume(0);
    frameAfterWindow();
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: true }); // suena: datos reales que valen 0

    engine.setVolume(1);
    engine.setMuted(true);
    frameAfterWindow();
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: true }); // suena: datos reales que valen 0

    engine.setMuted(false);
    frameAfterWindow();
    expect(levels.energy).toBeCloseTo(full.energy, 5);
    expect(levels.bass).toBeCloseTo(full.bass, 5);
  });

  it('sin Web Audio no hay bucle (la esfera queda inmóvil)', async () => {
    const fake = fakePlaybackEnvironment();
    const engine = new AudioEngine(fake.env);
    const frames = manualFrames();
    const meter = new AudioLevelsMeter(engine, frames.scheduler);
    meter.connect();
    engine.load('a', file('a.mp3'), { autoplay: true });
    fake.media().resolvePlay();
    await flush();
    expect(engine.getSnapshot().status).toBe('playing');
    expect(frames.pending.size).toBe(0);
    expect(meter.input.current).toEqual({ energy: 0, bass: 0, treble: 0, active: false });
  });

  it('desconectar cancela el fotograma pendiente; Strict Mode (conectar, limpiar, conectar) deja un solo bucle', async () => {
    const { frames, levels, contexts, playSong, frameAfterWindow, disconnect, meter, engine } =
      await setup();
    await playSong('a');
    contexts.last().signal = toneSignal(80, 0.3);
    frameAfterWindow();
    disconnect();
    expect(frames.pending.size).toBe(0);
    expect(levels).toEqual({ energy: 0, bass: 0, treble: 0, active: false });

    const cleanup = meter.connect();
    meter.connect(); // un segundo connect no duplica la suscripción
    expect(frames.pending.size).toBe(1);
    engine.setVolume(0.9); // cualquier notificación del motor
    expect(frames.pending.size).toBe(1);
    cleanup(); // limpieza antigua: ya no es la suscripción vigente
    expect(frames.pending.size).toBe(1);
    meter.disconnect();
    expect(frames.pending.size).toBe(0);
  });
});
