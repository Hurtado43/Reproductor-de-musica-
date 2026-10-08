import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, BLOCKED_MESSAGE } from '../src/features/player/audio/AudioEngine';
import { fakePlaybackEnvironment, flush } from './fakes/fakeMedia';

/*
 * Pruebas del motor con un elemento de audio SIMULADO (tests/fakes/fakeMedia.ts).
 * No hay sonido: se verifica la lógica de estado, versiones y limpieza. La
 * reproducción real se comprueba en el navegador.
 */

const file = (name: string) => new File([new Uint8Array(16)], name, { type: 'audio/mpeg' });

function setup() {
  const fake = fakePlaybackEnvironment();
  const engine = new AudioEngine(fake.env);
  const ended = vi.fn();
  engine.setEndedHandler(ended);
  return { engine, ended, ...fake };
}

describe('carga', () => {
  it('no crea el elemento hasta la primera carga', () => {
    const { engine, elements } = setup();
    expect(elements).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'empty', songId: null, wantsToPlay: false });
  });

  it('carga en pausa: lee la duración real del elemento y no reproduce', () => {
    const { engine, media, created } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    expect(engine.getSnapshot()).toMatchObject({ songId: 'a', status: 'loading', currentTime: 0 });
    expect(media().src).toBe(created[0]);
    media().loadMeta(204.83);
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', duration: 204.83 });
    expect(media().playCalls).toBe(0);
  });

  it('un solo elemento para todas las canciones', () => {
    const { engine, elements } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.load('b', file('b.mp3'), { autoplay: false });
    engine.load('c', file('c.mp3'), { autoplay: false });
    expect(elements).toHaveLength(1);
    expect(engine.mediaElement).toBe(elements[0]);
  });

  it('fuente inexistente muestra un error comprensible', () => {
    const { engine } = setup();
    engine.load('x', null, { autoplay: true });
    expect(engine.getSnapshot()).toMatchObject({
      songId: 'x',
      status: 'error',
      error: { kind: 'missing-source' },
    });
  });
});

describe('play, pausa y reanudación', () => {
  it('muestra "reproduciendo" solo cuando play() y el elemento lo confirman', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    media().loadMeta(60);
    engine.play();
    expect(engine.getSnapshot()).toMatchObject({ status: 'loading', wantsToPlay: true });
    media().emit('playing'); // el evento solo no basta mientras play() esté pendiente
    expect(engine.getSnapshot().status).toBe('loading');
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('pausa conserva currentTime y reanudar sigue desde ahí', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().loadMeta(60);
    media().resolvePlay();
    await flush();
    media().advance(12.5);
    engine.pause();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', currentTime: 12.5, wantsToPlay: false });
    expect(media().paused).toBe(true);
    engine.play();
    expect(media().currentTime).toBe(12.5);
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', currentTime: 12.5 });
  });

  it('play() rechazado por el navegador (NotAllowedError): pausa con aviso y se puede reintentar', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().rejectPlay('NotAllowedError');
    await flush();
    expect(engine.getSnapshot()).toMatchObject({
      status: 'paused',
      wantsToPlay: false,
      error: { kind: 'blocked', message: BLOCKED_MESSAGE },
    });
    engine.play();
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', error: null });
  });

  it.each([
    ['NotSupportedError', 'unsupported'],
    ['SomethingElse', 'play'],
  ])('play() rechazado con %s → error %s', async (name, kind) => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().rejectPlay(name);
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'error', error: { kind } });
  });

  it('play pendiente seguido de pausa: el rechazo esperado no se muestra como error', async () => {
    const { engine } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    engine.pause(); // el fake rechaza el play pendiente con AbortError
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', error: null, wantsToPlay: false });
  });

  it('play pendiente seguido de pausa: si la promesa se resuelve igual, no vuelve a "reproduciendo"', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    engine.play();
    const pending = media().pending[0]!;
    media().pending = []; // simula un navegador que resuelve en lugar de rechazar
    engine.pause();
    pending.resolve();
    await flush();
    expect(engine.getSnapshot().status).toBe('paused');
  });
});

describe('cambios de canción', () => {
  it('desvincula el audio antes de revocar la URL anterior y quita sus listeners', () => {
    const { engine, media, order, revoked } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    const listenersA = media().listenerCount();
    engine.load('b', file('b.mp3'), { autoplay: false });
    expect(revoked).toHaveLength(1);
    expect(order[0]).toContain('src del elemento: ""'); // ya desvinculado al revocar
    expect(media().listenerCount()).toBe(listenersA); // los de A se quitaron
    expect(engine.getSnapshot()).toMatchObject({ songId: 'b', status: 'loading', currentTime: 0 });
  });

  it('cambios rápidos A → B → C: solo C cuenta, aunque A y B respondan tarde', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    const playA = media().pending[0]!;
    engine.load('b', file('b.mp3'), { autoplay: true });
    engine.load('c', file('c.mp3'), { autoplay: true });
    media().loadMeta(90);
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ songId: 'c', status: 'playing', duration: 90 });
    playA.resolve(); // respuesta antigua que llega después de una reproducción válida
    playA.reject(new Error('tarde'));
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ songId: 'c', status: 'playing', error: null });
    expect(media().paused).toBe(false);
  });

  it('un error antiguo no cambia el estado de la canción nueva', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    const playA = media().pending[0]!;
    media().pending = [];
    engine.load('b', file('b.mp3'), { autoplay: false });
    media().loadMeta(30);
    playA.reject(Object.assign(new Error('x'), { name: 'NotSupportedError' }));
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ songId: 'b', status: 'paused', error: null });
  });

  it('los eventos de una fuente anterior no hacen avanzar ni cambian el estado', () => {
    const { engine, media, ended } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    const oldEnded = media().snapshotListeners('ended');
    const oldTime = media().snapshotListeners('timeupdate');
    const oldError = media().snapshotListeners('error');
    engine.load('b', file('b.mp3'), { autoplay: false });
    media().loadMeta(40);
    media().currentTime = 33;
    for (const fn of [...oldEnded, ...oldTime, ...oldError]) fn(); // eventos tardíos de A
    expect(ended).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toMatchObject({ songId: 'b', status: 'paused', currentTime: 0, error: null });
  });
});

describe('final de la canción', () => {
  it('avisa una sola vez y queda "finalizada"; reproducir de nuevo empieza en 0', async () => {
    const { engine, media, ended } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().loadMeta(10);
    media().resolvePlay();
    await flush();
    media().finish();
    media().emit('ended'); // un segundo evento no vuelve a avisar
    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith('a');
    expect(engine.getSnapshot()).toMatchObject({ status: 'ended', wantsToPlay: false, currentTime: 10 });
    engine.play();
    expect(media().currentTime).toBe(0);
    media().resolvePlay();
    await flush();
    expect(engine.getSnapshot().status).toBe('playing');
  });
});

describe('desplazamiento, volumen y silencio', () => {
  it('seek valida, limita al intervalo real y conserva reproducción o pausa', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    expect(engine.seek(5)).toBe(false); // duración aún desconocida
    media().loadMeta(7.24);
    expect(engine.seek(Number.NaN)).toBe(false);
    expect(engine.seek(Infinity)).toBe(false);
    expect(engine.seek(3)).toBe(true);
    expect(media().currentTime).toBe(3);
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', currentTime: 3 });
    expect(engine.seek(99)).toBe(true);
    expect(media().currentTime).toBe(7.24); // duración precisa, no la redondeada
    engine.seek(-4);
    expect(media().currentTime).toBe(0);

    engine.play();
    media().resolvePlay();
    await flush();
    const pauses = media().pauseCalls;
    engine.seek(2);
    expect(media().pauseCalls).toBe(pauses);
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('volumen y silencio modifican el elemento; silenciar conserva el volumen', () => {
    const { engine, media } = setup();
    engine.setVolume(0.4);
    engine.load('a', file('a.mp3'), { autoplay: false });
    expect(media().volume).toBe(0.4); // se aplica al crear el elemento
    engine.setMuted(true);
    expect(media().muted).toBe(true);
    expect(media().volume).toBe(0.4);
    expect(engine.getSnapshot()).toMatchObject({ volume: 0.4, muted: true });
    engine.setVolume(3);
    expect(media().volume).toBe(1);
    engine.setVolume(Number.NaN);
    expect(media().volume).toBe(1);
    engine.setMuted(false);
    expect(engine.getSnapshot().muted).toBe(false);
  });
});

describe('limpieza de recursos', () => {
  it('unload detiene, desvincula, revoca y quita listeners', async () => {
    const { engine, media, created, revoked } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    engine.unload();
    await flush();
    expect(media().paused).toBe(true);
    expect(media().src).toBe('');
    expect(revoked).toEqual(created);
    expect(media().listenerCount()).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'empty', songId: null, currentTime: 0, duration: null });
  });

  it('dispose invalida respuestas pendientes; una carga posterior crea un elemento nuevo', async () => {
    const { engine, media, elements } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    const pending = media().pending[0]!;
    media().pending = [];
    engine.dispose();
    pending.resolve();
    await flush();
    expect(engine.getSnapshot().status).toBe('empty');
    expect(engine.mediaElement).toBeNull();
    engine.load('b', file('b.mp3'), { autoplay: false });
    expect(elements).toHaveLength(2);
    expect(elements[0]!.listenerCount()).toBe(0);
  });
});

describe('estados del elemento', () => {
  it.each([
    [2, 'load'],
    [3, 'decode'],
    [4, 'unsupported'],
  ])('error del elemento con código %s → %s', (code, kind) => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    media().error = { code };
    media().emit('error');
    expect(engine.getSnapshot()).toMatchObject({ status: 'error', error: { kind } });
  });

  it('play después de un error vuelve a cargar la canción', () => {
    const { engine, media, created } = setup();
    engine.load('a', file('a.mp3'), { autoplay: false });
    media().error = { code: 2 };
    media().emit('error');
    engine.play();
    expect(created).toHaveLength(2);
    expect(engine.getSnapshot()).toMatchObject({ songId: 'a', status: 'loading', wantsToPlay: true });
  });

  it('espera de datos → "esperando"; al reanudar vuelve a "reproduciendo"', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().resolvePlay();
    await flush();
    media().emit('waiting');
    expect(engine.getSnapshot().status).toBe('buffering');
    media().emit('playing');
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('una pausa externa (teclas multimedia) se refleja como pausa', async () => {
    const { engine, media } = setup();
    engine.load('a', file('a.mp3'), { autoplay: true });
    media().resolvePlay();
    await flush();
    media().paused = true;
    media().emit('pause');
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', wantsToPlay: false });
  });
});
