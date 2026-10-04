import { describe, it, expect } from 'vitest';
import { canSpell, letterHandId, spellWord } from '../fingerspell.js';
import { vocab } from './helpers.js';

describe('fingerspell', () => {
  it('maps letters and digits to their dedicated handshape ids', () => {
    expect(letterHandId('a')).toBe('HLA');
    expect(letterHandId('Z')).toBe('HLZ');
    expect(letterHandId('7')).toBe('HN7');
    expect(letterHandId('!')).toBe(null);
  });

  it('finds the fingerspelling hands in the real seed vocabulary', () => {
    expect(canSpell(vocab)).toBe(true);
  });

  it('builds one step per letter, skipping punctuation', () => {
    const w = spellWord("Sarah!", vocab);
    expect(w.gloss).toBe('SARAH');
    expect(w.signForm).toHaveLength(5);
    expect(w.signForm[0].H.right).toBe('HLS');
    expect(w.signForm[0].H.left).toBe(null);
    expect(w.signForm[4].H.right).toBe('HLH');
  });

  it('spells digits too', () => {
    const w = spellWord('42', vocab);
    expect(w.gloss).toBe('42');
    expect(w.signForm.map((s) => s.H.right)).toEqual(['HN4', 'HN2']);
  });
});
