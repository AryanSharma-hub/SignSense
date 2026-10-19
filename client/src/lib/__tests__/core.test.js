import { describe, it, expect } from 'vitest';
import { resolveHands } from '../resolveHands.js';
import { mergeFull, stepHasAny, blankStep } from '../steps.js';
import { computeTargets, motionOffset } from '../pose.js';
import { searchGestures } from '../search.js';
import { playSignForm, playSequence } from '../playSignForm.js';
import { applyMarker, markerFor } from '../nonManual.js';
import { vocab, gestures } from './helpers.js';

describe('resolveHands', () => {
  it('forces both hands for inherently two-palm shapes, on either side', () => {
    expect(resolveHands({ right: 'H02', left: null }, vocab)).toEqual({ right: 'H02', left: 'H02', joined: true });
    expect(resolveHands({ right: null, left: 'H12' }, vocab)).toEqual({ right: 'H12', left: 'H12', joined: true });
    expect(resolveHands({ right: 'H09', left: 'H09' }, vocab).joined).toBe(true);
  });
  it('keeps different shapes independent', () => {
    expect(resolveHands({ right: 'H13', left: 'H03' }, vocab)).toEqual({ right: 'H13', left: 'H03', joined: false });
    expect(resolveHands({ right: 'H05', left: null }, vocab).joined).toBe(false);
  });
});

describe('steps & pose', () => {
  it('merges steps with later steps winning, hand-aware', () => {
    const m = mergeFull([{ E: 'E01', H: { right: 'H05' } }, { M: { left: 'M02' } }, { E: 'E02', L: 'L04' }]);
    expect(m).toMatchObject({ E: 'E02', L: 'L04', H: { right: 'H05', left: null }, M: { right: null, left: 'M02' } });
    expect(stepHasAny(blankStep())).toBe(false);
    expect(stepHasAny({ ...blankStep(), L: 'L02' })).toBe(true);
  });
  it('anchors hands at the chosen location, and rests otherwise', () => {
    const at = computeTargets({ H: { right: 'H07' }, L: 'L04' }, vocab);
    expect(at.hands.right.y).toBeLessThan(150);               // up at the chin, not down at the waist
    expect(at.hands.right.y).toBeGreaterThan(100);
    expect(at.hands.right.x).toBeGreaterThan(120);            // beside the face, not over the mouth
    expect(at.hands.left.active).toBe(false);
    // no location: made in neutral space in front of the chest; the unused hand hangs at its side
    const neutral = computeTargets({ H: { right: 'H07' } }, vocab);
    expect(neutral.hands.right).toMatchObject({ x: 156, y: 184, active: true });
    expect(neutral.hands.left).toMatchObject({ x: 64, y: 234, active: false });
  });
  it('MOTHER vs FATHER differ only by location', () => {
    const [m, f] = ['MOTHER', 'FATHER'].map((g) => gestures.find((x) => x.gloss === g).signForm);
    expect(m[0].H).toEqual(f[0].H);
    expect(m[1]).toEqual(f[1]);
    expect(m[0].L).not.toBe(f[0].L);
    const pm = computeTargets(mergeFull(m), vocab), pf = computeTargets(mergeFull(f), vocab);
    expect(pm.hands.right.y).toBeGreaterThan(pf.hands.right.y); // chin is lower than forehead
  });
  it('joined signs drive both hands to one shared place; motion strokes then settle', () => {
    const t = computeTargets({ H: { right: 'H12' }, M: { right: 'M10' }, L: 'L01' }, vocab);
    expect(t.joined).toBe(true);
    expect(t.hands.right.y).toBe(t.hands.left.y);
    const o = motionOffset({ kind: 'stroke', x: 10, y: -10 }, 1);
    expect(o).toEqual({ x: 10, y: -10 });
  });
});

describe('search', () => {
  it('ranks an exact 5-parameter match first and tags it exact', () => {
    // THANK YOU: smile + forward tilt, flat B hand, leaving the mouth (last location wins in the flat query)
    const q = { E: 'E02', H: 'HX_OPEN_B', HD: 'HD03', L: 'LX_HEADAWAY' };
    const r = searchGestures(q, gestures, vocab);
    expect(r[0].gloss).toBe('THANK YOU');
    expect(r[0].exact).toBe(true);
  });
  it('location alone separates MOTHER from FATHER', () => {
    const q = { H: 'HX_5', M: 'MX_STRAIGHT_REP', L: 'L02' }; // thumb of a 5-hand tapping the forehead
    expect(searchGestures(q, gestures, vocab)[0].gloss).toBe('FATHER');
    expect(searchGestures({ ...q, L: 'L04' }, gestures, vocab)[0].gloss).toBe('MOTHER');
  });
});

describe('sequencer + non-manual markers', () => {
  const fast = { hold: 1, gap: 1, wordGap: 1 };
  it('accumulates steps, persists earlier params, and reports every frame', async () => {
    const frames = [];
    const ok = await playSignForm(gestures[0].signForm, { ...fast, onFrame: (p) => frames.push(p) });
    expect(ok).toBe(true);
    // HELLO: flat B at the forehead, then travelling away from the head
    expect(frames).toHaveLength(2);
    expect(frames[1].H.right).toBe('HX_CLOSED_B'); // set in step 1, still held in step 2
    expect(frames[1].L).toBe('LX_HEADAWAY');       // set in step 2
  });
  it('aborts cleanly', async () => {
    const ac = new AbortController();
    const p = playSignForm(gestures[0].signForm, { hold: 50, gap: 1, signal: ac.signal });
    ac.abort();
    expect(await p).toBe(false);
  });
  it('layers a question / negation marker over every step and plays sequences', async () => {
    const q = markerFor({ type: 'question' }, vocab);
    const steps = applyMarker(gestures[0].signForm, q);
    expect(steps.every((s) => s.E === 'E09')).toBe(true);
    const neg = applyMarker(gestures[0].signForm, markerFor({ type: 'negation' }, vocab));
    expect(neg.every((s) => s.HD === 'HD04' && s.E === 'E04')).toBe(true);
    const seen = [];
    await playSequence([gestures[0], gestures[1]], { ...fast, onWord: (i) => seen.push(i) });
    expect(seen).toEqual([0, 1]);
  });
});
