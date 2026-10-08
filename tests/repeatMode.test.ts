import { describe, expect, it } from 'vitest';
import { actionAfterEnd, isRepeatMode, nextRepeatMode } from '../src/features/player/repeatMode';

describe('modo de repetición', () => {
  it('cicla desactivada → playlist → canción → desactivada', () => {
    expect(nextRepeatMode('off')).toBe('all');
    expect(nextRepeatMode('all')).toBe('one');
    expect(nextRepeatMode('one')).toBe('off');
  });

  it('reconoce solo los tres valores válidos', () => {
    expect(['off', 'all', 'one'].every(isRepeatMode)).toBe(true);
    for (const v of [undefined, null, 'ALL', 1, 'loop']) expect(isRepeatMode(v)).toBe(false);
  });

  it('decisión al terminar', () => {
    // Desactivada: siguiente; en la última, finalizada.
    expect(actionAfterEnd('off', true, 3)).toBe('next');
    expect(actionAfterEnd('off', false, 3)).toBe('stop');
    expect(actionAfterEnd('off', false, 1)).toBe('stop');
    // Repetir playlist: siguiente; desde la última, la primera.
    expect(actionAfterEnd('all', true, 3)).toBe('next');
    expect(actionAfterEnd('all', false, 3)).toBe('first');
    // Repetir canción: siempre la misma.
    expect(actionAfterEnd('one', true, 3)).toBe('replay');
    expect(actionAfterEnd('one', false, 3)).toBe('replay');
    // Una sola canción: ambos modos la repiten.
    expect(actionAfterEnd('all', false, 1)).toBe('replay');
    expect(actionAfterEnd('one', false, 1)).toBe('replay');
  });
});
