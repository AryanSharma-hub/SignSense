import { describe, it, expect } from 'vitest';
import { createClock } from '../clock.js';
import { buildTimeline, playSignForm } from '../playSignForm.js';
import { markerFor } from '../nonManual.js';
import { searchText, explainMatch } from '../search.js';
import { vocab, gestures } from './helpers.js';

const elapsed = async (fn) => { const t = performance.now(); await fn(); return performance.now() - t; };

describe('playback clock', () => {
  it('runs slower at practice speed', async () => {
    const c = createClock({ speed: 0.5 });
    expect(await elapsed(() => c.wait(40))).toBeGreaterThanOrEqual(70);
  });
  it('holds while paused and continues on resume', async () => {
    const c = createClock();
    let done = false;
    const p = c.wait(30).then(() => { done = true; });
    c.set({ paused: true });
    await new Promise((r) => setTimeout(r, 60));
    expect(done).toBe(false);
    c.set({ paused: false });
    await p;
    expect(done).toBe(true);
  });
  it('resolves immediately when aborted', async () => {
    const c = createClock();
    const ac = new AbortController();
    const p = c.wait(10000, ac.signal);
    ac.abort();
    expect(await elapsed(() => p)).toBeLessThan(50);
  });
  it('drives playSignForm without changing the sequence', async () => {
    const frames = [];
    const ok = await playSignForm(gestures[0].signForm, { hold: 1, gap: 1, clock: createClock({ speed: 2 }), onFrame: (p) => frames.push(p) });
    expect(ok).toBe(true);
    expect(frames).toHaveLength(gestures[0].signForm.length);
  });
});

describe('timeline', () => {
  it('lays out one frame per step across words, accumulating each word separately', () => {
    const words = [gestures[0], gestures[1]];
    const t = buildTimeline(words);
    expect(t).toHaveLength(words[0].signForm.length + words[1].signForm.length);
    expect(t[0]).toMatchObject({ word: 0, step: 0, gloss: words[0].gloss });
    const firstOfSecond = t.find((f) => f.word === 1);
    expect(firstOfSecond.step).toBe(0);
    expect(t[1].pose.H.right).toBe('HX_CLOSED_B'); // held from step 1 of the first word (HELLO)
  });
  it('applies grammar markers to every frame', () => {
    const t = buildTimeline([gestures[0]], markerFor({ type: 'question' }, vocab));
    expect(t.every((f) => f.pose.E === 'E09')).toBe(true);
  });
});

describe('library search', () => {
  it('ranks the exact sign name first and says why', () => {
    const r = searchText('water', gestures);
    expect(r[0].gesture.gloss).toBe('WATER');
    expect(r[0].exact).toBe(true);
    expect(r[0].reason).toMatch(/Exact/);
  });
  it('returns nothing for text that matches no sign', () => {
    expect(searchText('zzqqxx', gestures)).toEqual([]);
    expect(searchText('   ', gestures)).toEqual([]);
  });
  it('explains parameter matches per parameter', () => {
    const father = gestures.find((g) => g.gloss === 'FATHER');
    const why = explainMatch({ H: father.flat.H, L: 'L04' }, father.flat, vocab);
    expect(why.find((w) => w.k === 'H').kind).toBe('same');
    expect(why.find((w) => w.k === 'L').kind).not.toBe('same');
  });
});
