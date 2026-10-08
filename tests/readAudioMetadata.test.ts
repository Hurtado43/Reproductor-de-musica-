import { describe, expect, it, vi } from 'vitest';
import { isDeclaredMp3, looksLikeMp3 } from '../src/features/player/audio/mp3Signature';
import {
  AudioImportError,
  readAudioMetadata,
  type AudioElementLike,
  type MetadataEnvironment,
} from '../src/features/player/audio/readAudioMetadata';

/*
 * Pruebas unitarias con un elemento de audio y URLs SIMULADOS. La lectura con
 * un MP3 real se comprueba aparte, en el navegador (ver docs/progreso.md).
 */

/** Cabecera de trama MPEG-1 Layer III (128 kbps, 44,1 kHz). */
const FRAME = [0xff, 0xfb, 0x90, 0x00];
const ID3 = [0x49, 0x44, 0x33, 0x04, 0x00];

function mp3File(name = 'tema.mp3', type = 'audio/mpeg', bytes: number[] = [...ID3, ...FRAME]) {
  return new File([new Uint8Array(bytes)], name, { type });
}

class FakeAudio implements AudioElementLike {
  preload = '';
  muted = false;
  src = '';
  currentTime = 0;
  duration = Number.NaN;
  loadCalls = 0;
  readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
  load() {
    this.loadCalls += 1;
  }
  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
}

function fakeEnvironment() {
  const audios: FakeAudio[] = [];
  const created: string[] = [];
  const revoked: string[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const env: MetadataEnvironment = {
    createAudio: () => {
      const audio = new FakeAudio();
      audios.push(audio);
      return audio;
    },
    createObjectURL: () => {
      const url = `blob:fake-${created.length + 1}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url) => {
      revoked.push(url);
    },
    setTimeout: (callback) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id as number);
    },
  };
  const audio = async () => {
    await vi.waitFor(() => expect(audios.length).toBe(1));
    return audios[0]!;
  };
  const fireTimeout = () => {
    for (const [id, callback] of timers) {
      timers.delete(id);
      callback();
    }
  };
  return { env, audios, created, revoked, timers, audio, fireTimeout };
}

/** Comprueba que no quedó nada sin liberar. */
function expectCleaned(fake: ReturnType<typeof fakeEnvironment>) {
  const audio = fake.audios[0]!;
  expect(audio.listenerCount()).toBe(0);
  expect(audio.src).toBe('');
  expect(audio.loadCalls).toBe(1);
  expect(fake.revoked).toEqual(fake.created);
  expect(fake.timers.size).toBe(0);
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AudioImportError);
  expect((error as AudioImportError).code).toBe(code);
}

describe('firma y tipo declarado', () => {
  it('acepta .mp3 aunque el tipo esté vacío, y audio/mpeg sin extensión', () => {
    expect(isDeclaredMp3({ name: 'a.mp3', type: '' })).toBe(true);
    expect(isDeclaredMp3({ name: 'A.MP3', type: '' })).toBe(true);
    expect(isDeclaredMp3({ name: 'audio', type: 'audio/mpeg' })).toBe(true);
    expect(isDeclaredMp3({ name: 'a.wav', type: 'audio/wav' })).toBe(false);
    expect(isDeclaredMp3({ name: 'a.txt', type: '' })).toBe(false);
  });

  it('reconoce ID3 y tramas Layer III, y rechaza otros contenidos', () => {
    expect(looksLikeMp3(new Uint8Array(ID3))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0, 0, ...FRAME]))).toBe(true);
    expect(looksLikeMp3(new TextEncoder().encode('hola, esto es texto'))).toBe(false);
    expect(looksLikeMp3(new TextEncoder().encode('RIFF....WAVEfmt '))).toBe(false);
    expect(looksLikeMp3(new TextEncoder().encode('OggS\u0000\u0002'))).toBe(false);
    // Layer II (0xFD) no es MP3.
    expect(looksLikeMp3(new Uint8Array([0xff, 0xfd, 0x90, 0x00]))).toBe(false);
  });
});

describe('readAudioMetadata', () => {
  it('lee la duración precisa y libera URL, listeners y temporizador', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env });
    const audio = await fake.audio();
    expect(audio.preload).toBe('metadata');
    expect(audio.muted).toBe(true);
    expect(audio.src).toBe('blob:fake-1');
    audio.duration = 204.83;
    audio.emit('loadedmetadata');
    await expect(promise).resolves.toEqual({ durationSeconds: 204.83 });
    expectCleaned(fake);
  });

  it('no rechaza un MP3 válido con File.type vacío', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File('sin-tipo.mp3', ''), { environment: fake.env });
    const audio = await fake.audio();
    audio.duration = 3;
    audio.emit('loadedmetadata');
    await expect(promise).resolves.toEqual({ durationSeconds: 3 });
  });

  it('rechaza un archivo vacío sin crear el elemento de audio', async () => {
    const fake = fakeEnvironment();
    await expectCode(readAudioMetadata(mp3File('vacio.mp3', 'audio/mpeg', []), { environment: fake.env }), 'empty');
    expect(fake.audios).toHaveLength(0);
  });

  it('rechaza un archivo que no se declara MP3', async () => {
    const fake = fakeEnvironment();
    await expectCode(
      readAudioMetadata(mp3File('tema.wav', 'audio/wav'), { environment: fake.env }),
      'not-mp3',
    );
    expect(fake.audios).toHaveLength(0);
  });

  it('rechaza un .mp3 cuyo contenido no es MP3 (no confía en la extensión)', async () => {
    const fake = fakeEnvironment();
    const text = [...new TextEncoder().encode('esto no es audio')];
    await expectCode(
      readAudioMetadata(mp3File('falso.mp3', 'audio/mpeg', text), { environment: fake.env }),
      'not-mp3',
    );
    expect(fake.audios).toHaveLength(0);
  });

  it('error de lectura del archivo', async () => {
    const fake = fakeEnvironment();
    const unreadable = {
      name: 'tema.mp3',
      type: 'audio/mpeg',
      size: 100,
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error('NotReadableError')) }),
    } as unknown as File;
    await expectCode(readAudioMetadata(unreadable, { environment: fake.env }), 'read-error');
  });

  it('error al crear la URL temporal', async () => {
    const fake = fakeEnvironment();
    const env = {
      ...fake.env,
      createObjectURL: () => {
        throw new Error('sin memoria');
      },
    };
    await expectCode(readAudioMetadata(mp3File(), { environment: env }), 'read-error');
    expect(fake.audios[0]!.listenerCount()).toBe(0);
    expect(fake.timers.size).toBe(0);
  });

  it('error de metadatos del navegador', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env });
    (await fake.audio()).emit('error');
    await expectCode(promise, 'unsupported');
    expectCleaned(fake);
  });

  it.each([Number.NaN, 0, -1])('duración %s → invalid-duration', async (duration) => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env });
    const audio = await fake.audio();
    audio.duration = duration;
    audio.emit('loadedmetadata');
    await expectCode(promise, 'invalid-duration');
    expectCleaned(fake);
  });

  it('duración Infinity: fuerza el cálculo y espera durationchange', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env });
    const audio = await fake.audio();
    audio.duration = Infinity;
    audio.emit('loadedmetadata');
    expect(audio.currentTime).toBeGreaterThan(1e6);
    audio.emit('durationchange'); // todavía Infinity: sigue esperando
    audio.duration = 61.5;
    audio.emit('durationchange');
    await expect(promise).resolves.toEqual({ durationSeconds: 61.5 });
    expectCleaned(fake);
  });

  it('tiempo de espera agotado', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env, timeoutMs: 50 });
    await fake.audio();
    fake.fireTimeout();
    await expectCode(promise, 'timeout');
    expectCleaned(fake);
  });

  it('tiempo de espera real (temporizadores del entorno)', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeEnvironment();
      const promise = readAudioMetadata(mp3File(), {
        environment: {
          ...fake.env,
          setTimeout: (cb, ms) => setTimeout(cb, ms),
          clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
        },
        timeoutMs: 10_000,
      });
      const settled = promise.catch((e: unknown) => e);
      await vi.waitFor(() => expect(fake.audios).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(10_000);
      const error = await settled;
      expect((error as AudioImportError).code).toBe('timeout');
      expect(fake.revoked).toEqual(fake.created);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelar con AbortSignal libera los recursos', async () => {
    const fake = fakeEnvironment();
    const controller = new AbortController();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env, signal: controller.signal });
    await fake.audio();
    controller.abort();
    await expectCode(promise, 'aborted');
    expectCleaned(fake);
    // Un evento tardío ya no tiene efecto.
    fake.audios[0]!.duration = 10;
    fake.audios[0]!.emit('loadedmetadata');
  });

  it('una señal ya cancelada no crea recursos', async () => {
    const fake = fakeEnvironment();
    const controller = new AbortController();
    controller.abort();
    await expectCode(readAudioMetadata(mp3File(), { environment: fake.env, signal: controller.signal }), 'aborted');
    expect(fake.audios).toHaveLength(0);
    expect(fake.created).toHaveLength(0);
  });

  it('solo se resuelve una vez aunque lleguen varios eventos', async () => {
    const fake = fakeEnvironment();
    const promise = readAudioMetadata(mp3File(), { environment: fake.env });
    const audio = await fake.audio();
    audio.duration = 5;
    audio.emit('loadedmetadata');
    audio.emit('error');
    await expect(promise).resolves.toEqual({ durationSeconds: 5 });
    expect(fake.revoked).toHaveLength(1);
  });

  it('nunca intenta reproducir el audio', async () => {
    const fake = fakeEnvironment();
    const play = vi.fn();
    const env = {
      ...fake.env,
      createAudio: () => Object.assign(fake.env.createAudio(), { play }),
    };
    const promise = readAudioMetadata(mp3File(), { environment: env });
    const audio = await fake.audio();
    audio.duration = 2;
    audio.emit('loadedmetadata');
    await promise;
    expect(play).not.toHaveBeenCalled();
  });
});
