import { describe, expect, it } from 'vitest';
import { createSong, DuplicateSongIdError, Playlist } from '../src/domain';
import { createIdGenerator } from '../src/lib/idGenerator';

const input = { title: 'T', artist: 'A', durationSeconds: 60 };

describe('createIdGenerator', () => {
  it('usa crypto.randomUUID cuando existe', () => {
    let calls = 0;
    const generate = createIdGenerator({ randomUUID: () => `uuid-${++calls}` });
    expect(generate()).toBe('uuid-1');
    expect(generate()).toBe('uuid-2');
  });

  it('usa el randomUUID real del entorno por defecto', () => {
    const id = createIdGenerator()();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sin randomUUID (contexto no seguro) genera ids locales únicos sin lanzar errores', () => {
    const generate = createIdGenerator({
      getRandomValues: <T extends ArrayBufferView>(array: T) => array,
    });
    const ids = Array.from({ length: 1000 }, () => generate());
    expect(new Set(ids).size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^local-[0-9a-f]{8}-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('sin ninguna API de crypto usa Math.random para la sesión', () => {
    const generate = createIdGenerator(undefined);
    expect(() => generate()).not.toThrow();
    expect(generate()).not.toBe(generate());
  });

  it('si randomUUID lanza un error, usa la alternativa local', () => {
    const generate = createIdGenerator({
      randomUUID: () => {
        throw new Error('no disponible');
      },
    });
    expect(generate()).toMatch(/^local-/);
  });

  it('dos generadores alternativos tienen sesiones distintas', () => {
    let n = 0;
    const source = {
      getRandomValues: <T extends ArrayBufferView>(array: T) => {
        new Uint8Array(array.buffer).fill(++n);
        return array;
      },
    };
    const a = createIdGenerator(source)();
    const b = createIdGenerator(source)();
    expect(a.split('-')[1]).not.toBe(b.split('-')[1]);
  });

  it('no calcula nada aleatorio al crearse (solo al pedir el primer id)', () => {
    let randomCalls = 0;
    const generate = createIdGenerator({
      getRandomValues: <T extends ArrayBufferView>(array: T) => {
        randomCalls++;
        return array;
      },
    });
    expect(randomCalls).toBe(0);
    generate();
    generate();
    expect(randomCalls).toBe(1);
  });
});

describe('ids duplicados', () => {
  it('la playlist no acepta un id repetido aunque el generador lo repita', () => {
    const generate = createIdGenerator({ randomUUID: () => 'siempre-igual' });
    const playlist = new Playlist();
    playlist.addLast(createSong(input, generate));
    expect(() => playlist.addLast(createSong(input, generate))).toThrow(DuplicateSongIdError);
    expect(playlist.size).toBe(1);
  });
});
