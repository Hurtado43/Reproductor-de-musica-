import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, RESUME_TIMEOUT_MS } from '../src/features/player/audio/AudioEngine';
import { fakeAudioContextFactory } from './fakes/fakeAudioContext';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Ruta de Web Audio del motor con un elemento de audio, un AudioContext, un
 * MediaElementAudioSourceNode y un AnalyserNode SIMULADOS
 * (tests/fakes/fakeMedia.ts y tests/fakes/fakeAudioContext.ts). No hay sonido:
 * se verifica cuándo se crean los recursos, qué se conecta, cómo se coordinan
 * resume() y play() y cómo se liberan. La ruta real se midió en el navegador.
 */

const file = (name: string) => new File([new Uint8Array(16)], name, { type: 'audio/mpeg' });

type ContextOptions = Parameters<typeof fakeAudioContextFactory>[0];

function setup(options: ContextOptions = {}) {
  const contexts = fakeAudioContextFactory(options);
  const fake = fakePlaybackEnvironment({ createAudioContext: contexts.create });
  const engine = new AudioEngine(fake.env);
  return { engine, contexts, ctx: contexts.last, ...fake };
}

afterEach(() => {
  vi.useRealTimers();
});

const ROUTE = ['source->analyser', 'analyser->destination'];

describe('creación diferida y única', () => {
  it('cargar no crea el AudioContext; el primer Reproducir crea contexto, fuente y ruta única', async () => {
    const { engine, contexts, media } = setup({ autoResume: true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    expect(contexts.contexts).toHaveLength(0);

    engine.play();
    expect(contexts.contexts).toHaveLength(1);
    const ctx = contexts.last();
    expect(ctx.sourceCalls).toBe(1);
    expect(ctx.source!.element).toBe(media());
    expect(ctx.edges).toEqual(ROUTE);
    expect(ctx.edges).not.toContain('source->destination');
    expect(ctx.analyser!.fftSize).toBe(2048);
    expect(ctx.analyser!.smoothingTimeConstant).toBe(0);
    expect(engine.outputGraph?.analyser).toBe(ctx.analyser);

    await flush();
    expect(media().playCalls).toBe(1); // play() después de resume()
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('no recrea la fuente al pausar, reanudar, repetir ni cambiar de canción', async () => {
    const { engine, contexts, elements } = setup({ autoResume: true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    for (let i = 0; i < 5; i++) {
      engine.play();
      await flush();
      engine.pause();
    }
    engine.load('b', file('b.mp3'), { autoplay: true });
    await flush();
    engine.load('c', file('c.mp3'), { autoplay: true });
    engine.load('a', file('a.mp3'), { autoplay: true });
    await flush();
    engine.togglePlay();
    engine.togglePlay();
    await flush();

    expect(elements).toHaveLength(1);
    expect(contexts.contexts).toHaveLength(1);
    expect(contexts.last().sourceCalls).toBe(1);
    expect(contexts.last().edges).toEqual(ROUTE);
  });

  it('clics rápidos con resume() pendiente: un contexto, una fuente y un solo play()', async () => {
    const { engine, contexts, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.pause();
    engine.play();
    engine.pause();
    engine.play();
    const ctx = contexts.last();
    expect(contexts.contexts).toHaveLength(1);
    expect(ctx.sourceCalls).toBe(1);
    expect(ctx.resumeCalls).toBe(3);

    // Responden los tres resume(): solo el último (vigente) llama a play().
    ctx.resolveResume();
    ctx.resolveResume();
    ctx.resolveResume();
    await flush();
    expect(media().playCalls).toBe(1);
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', wantsToPlay: true });
  });

  it('con el contexto ya en marcha, play() se llama de inmediato (sin esperar)', () => {
    const { engine, media } = setup({ initialState: 'running' });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    expect(media().playCalls).toBe(1);
  });
});

describe('resume() pendiente y respuestas antiguas', () => {
  it('pausa mientras resume() está pendiente: no reproduce al resolverse', async () => {
    const { engine, ctx, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    expect(engine.getSnapshot()).toMatchObject({ status: 'loading', wantsToPlay: true });
    engine.pause();
    ctx().resolveResume();
    await flush();
    expect(media().playCalls).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', wantsToPlay: false, error: null });
  });

  it('cambio de canción mientras resume() está pendiente: la respuesta antigua no reproduce', async () => {
    const { engine, ctx, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.load('b', file('b.mp3'), { autoplay: false }); // por ejemplo, eliminar la actual
    ctx().resolveResume();
    await flush();
    expect(media().playCalls).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({ songId: 'b', wantsToPlay: false });
  });

  it('cambio a otra canción que debe sonar: solo suena la nueva', async () => {
    const { engine, ctx, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.load('b', file('b.mp3'), { autoplay: true });
    ctx().resolveResume();
    ctx().resolveResume();
    await flush();
    expect(media().playCalls).toBe(1);
    expect(media().src).toContain('b.mp3');
  });

  it('descargar o desmontar mientras resume() está pendiente: nada se reproduce ni queda un rechazo suelto', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const a = setup();
      a.engine.load('a', file('a.mp3'), { autoplay: false });
      a.engine.play();
      a.engine.unload();
      a.ctx().resolveResume();

      const b = setup();
      b.engine.load('a', file('a.mp3'), { autoplay: false });
      b.engine.play();
      b.engine.dispose();
      b.ctx().rejectResume();
      await flush();
      await new Promise((r) => setTimeout(r, 0));

      expect(a.media().playCalls).toBe(0);
      expect(b.media().playCalls).toBe(0);
      expect(a.engine.getSnapshot().status).toBe('empty');
      expect(b.engine.getSnapshot().status).toBe('empty');
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('resume() rechazado: error recuperable visible; Reproducir lo reintenta', async () => {
    const { engine, ctx, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    media().loadMeta(30);
    media().currentTime = 12;
    engine.play();
    ctx().rejectResume('NotAllowedError');
    await flush();
    expect(media().playCalls).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({
      status: 'paused',
      wantsToPlay: false,
      error: { kind: 'output' },
    });

    engine.play(); // nuevo gesto: reintenta sin recargar la canción
    expect(media().currentTime).toBe(12);
    ctx().resolveResume();
    await flush();
    expect(media().playCalls).toBe(1);
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', error: null });
  });

  it('resume() que no responde: error tras el tiempo límite, y la respuesta tardía se ignora', async () => {
    vi.useFakeTimers();
    const { engine, ctx, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', error: { kind: 'output' } });
    ctx().resolveResume();
    await vi.advanceTimersByTimeAsync(0);
    expect(media().playCalls).toBe(0);
  });

  it('pausar cancela el temporizador de resume()', async () => {
    vi.useFakeTimers();
    const { engine } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.pause();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Web Audio no disponible o con fallos', () => {
  it('sin AudioContext: reproducción convencional', async () => {
    const fake = fakePlaybackEnvironment(); // createAudioContext → null
    const engine = new AudioEngine(fake.env);
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    expect(fake.media().playCalls).toBe(1);
    expect(engine.outputGraph).toBeNull();
    fake.media().resolvePlay();
    await flush();
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('si crear el contexto lanza un error: reproducción convencional y no se reintenta', () => {
    let calls = 0;
    const fake = fakePlaybackEnvironment({
      createAudioContext: () => {
        calls++;
        throw new Error('sin hardware de audio');
      },
    });
    const engine = new AudioEngine(fake.env);
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.pause();
    engine.play();
    expect(fake.media().playCalls).toBe(2);
    expect(calls).toBe(1);
    expect(engine.getSnapshot().error).toBeNull();
  });

  it('si falla antes de crear la fuente: el elemento sigue en su ruta y el contexto se cierra', () => {
    for (const option of [{ failAnalyser: true }, { failCreateSource: true }]) {
      const { engine, ctx, media } = setup({ ...option, autoResume: true });
      engine.load('a', file('a.mp3'), { autoplay: false });
      engine.play();
      expect(ctx().closeCalls).toBe(1);
      expect(ctx().edges).toEqual([]);
      expect(media().playCalls).toBe(1); // convencional, sin esperar resume()
      expect(engine.outputGraph).toBeNull();
    }
  });

  it('si no se puede conectar el analizador: ruta de reserva fuente → destination (audible, sin análisis)', async () => {
    const { engine, ctx, media } = setup({
      autoResume: true,
      failConnect: (from) => from === 'analyser',
    });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    expect(ctx().edges).toEqual(['source->destination']);
    expect(engine.outputGraph?.analyser).toBeNull();
    await flush();
    expect(media().playCalls).toBe(1);
  });

  it('si tampoco hay ruta de reserva: elemento nuevo con la ruta convencional, sin fingir recuperación', async () => {
    const { engine, ctx, elements, revoked } = setup({ autoResume: true, failConnect: () => true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    expect(ctx().closeCalls).toBe(1);
    expect(elements).toHaveLength(2);
    expect(elements[0]!.playCalls).toBe(0); // el redirigido nunca se reproduce
    expect(elements[1]!.playCalls).toBe(1);
    expect(revoked).toHaveLength(1); // la URL del primer elemento se liberó
    expect(engine.mediaElement).toBe(elements[1]);
    expect(engine.outputGraph).toBeNull();
  });

  it('el sistema cierra el contexto mientras suena: error visible y Reproducir sustituye el elemento en el mismo punto', async () => {
    const { engine, ctx, elements, contexts } = setup({ autoResume: true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    elements[0]!.loadMeta(60);
    engine.play();
    await flush();
    elements[0]!.resolvePlay();
    await flush();
    elements[0]!.currentTime = 21;

    ctx().systemSetState('closed');
    expect(engine.getSnapshot()).toMatchObject({
      status: 'paused',
      wantsToPlay: false,
      error: { kind: 'output' },
    });
    expect(elements[0]!.paused).toBe(true);

    engine.play();
    expect(elements).toHaveLength(2);
    expect(elements[1]!.currentTime).toBe(21);
    expect(elements[1]!.playCalls).toBe(1);
    expect(contexts.contexts).toHaveLength(1); // no se crea otro grafo para el elemento nuevo
    elements[1]!.resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', error: null });
  });

  it('el sistema suspende el contexto mientras suena: pausa con error; Reproducir reanuda', async () => {
    const { engine, ctx, media } = setup({ initialState: 'running' });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    media().resolvePlay();
    await flush();
    ctx().systemSetState('suspended');
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', error: { kind: 'output' } });
    expect(media().paused).toBe(true);

    engine.play();
    ctx().resolveResume();
    await flush();
    expect(media().playCalls).toBe(2);
    expect(ctx().sourceCalls).toBe(1);
  });
});

describe('liberación y Strict Mode', () => {
  it('dispose: desvincula el elemento, desconecta los nodos y cierra el contexto una vez', async () => {
    const { engine, ctx, media, revoked, created } = setup({ autoResume: true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    await flush();
    const context = ctx();
    engine.dispose();
    expect(media().src).toBe('');
    expect(revoked).toEqual(created);
    expect(context.edges).toEqual([]);
    expect(context.source!.disconnectCalls).toBeGreaterThan(0);
    expect(context.analyser!.disconnectCalls).toBeGreaterThan(0);
    expect(context.closeCalls).toBe(1);
    expect(context.listenerCount()).toBe(0);
    engine.dispose();
    expect(context.closeCalls).toBe(1);
  });

  it('un close() rechazado no deja rechazos sin capturar', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { engine } = setup({ autoResume: true, closeRejects: true });
      engine.load('a', file('a.mp3'), { autoplay: false });
      engine.play();
      engine.dispose();
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('reutilizar el motor tras dispose (Strict Mode) crea elemento, contexto y fuente nuevos', async () => {
    const { engine, contexts, elements } = setup({ autoResume: true });
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    await flush();
    engine.dispose(); // limpieza del primer montaje

    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    await flush();
    expect(elements).toHaveLength(2);
    expect(contexts.contexts).toHaveLength(2);
    expect(contexts.contexts[0]!.state).toBe('closed');
    // El nodo fuente del segundo contexto es del elemento nuevo; el viejo no se reutiliza.
    expect(contexts.contexts[1]!.source!.element).toBe(elements[1]);
    expect(contexts.contexts[1]!.edges).toEqual(ROUTE);
    expect(elements[1]!.playCalls).toBe(1);
  });
});
