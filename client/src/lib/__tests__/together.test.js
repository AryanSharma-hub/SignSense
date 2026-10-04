import { describe, it, expect } from 'vitest';
import { blankStep, cloneStep, hasPair, togglePair, prunedTogether } from '../steps.js';

describe('togglePair', () => {
  it('adds a sorted pair, order-independent', () => {
    const t = togglePair([], 'M', 'HD');
    expect(t).toEqual([['HD', 'M']]);
    expect(hasPair(t, 'HD', 'M')).toBe(true);
    expect(hasPair(t, 'M', 'HD')).toBe(true);
  });
  it('removes the pair if it already exists (toggle off)', () => {
    const t = togglePair([['HD', 'M']], 'M', 'HD');
    expect(t).toEqual([]);
  });
  it('ignores a parameter paired with itself', () => {
    expect(togglePair([], 'E', 'E')).toEqual([]);
  });
});

describe('prunedTogether', () => {
  it('keeps a pair while both parameters are still filled', () => {
    const step = { ...blankStep(), E: 'E01', HD: 'HD01', together: [['E', 'HD']] };
    expect(prunedTogether(step)).toEqual([['E', 'HD']]);
  });
  it('drops a pair once either half is cleared', () => {
    const step = { ...blankStep(), E: null, HD: 'HD01', together: [['E', 'HD']] };
    expect(prunedTogether(step)).toEqual([]);
  });
  it('treats H/M as filled if either hand side is set', () => {
    const step = { ...blankStep(), H: { right: 'H01', left: null }, M: { right: null, left: 'M01' }, together: [['H', 'M']] };
    expect(prunedTogether(step)).toEqual([['H', 'M']]);
  });
});

describe('cloneStep', () => {
  it('deep-copies together pairs so mutating the clone never touches the original', () => {
    const original = { ...blankStep(), together: [['E', 'L']] };
    const clone = cloneStep(original);
    clone.together[0].push('extra');
    expect(original.together).toEqual([['E', 'L']]);
  });
  it('defaults together to an empty array when absent', () => {
    expect(cloneStep(null).together).toEqual([]);
  });
});
