import { describe, it, expect } from 'vitest';
import { speechToGloss } from '../speechToGloss/index.js';
import { detectSentenceType } from '../speechToGloss/sentenceType.js';
import { vocab, index } from './helpers.js';

const run = (t, opts = {}) => speechToGloss(t, { index, vocab, ...opts });
const glosses = (a) => a.words.map((w) => w.gloss);

describe('speech -> gloss (deterministic tier)', () => {
  it('paraphrases both surface WANT + WATER', async () => {
    expect(glosses(await run("I'd like some water"))).toEqual(['I', 'WANT', 'WATER']);
    expect(glosses(await run('give me water'))).toEqual(['WANT', 'WATER']);
    expect(glosses(await run('Can I have some water?'))).toEqual(['WANT', 'WATER']);
  });

  it('matches phrases and inflections', async () => {
    expect((await run('thank you so much')).words[0].gloss).toBe('THANK YOU');
    expect(glosses(await run('She was eating'))).toEqual(['EAT']);
    expect(glosses(await run('My mom needs help'))).toEqual(['MOTHER', 'WANT', 'HELP']);
    expect(glosses(await run('my dad is hungry'))).toEqual(['FATHER', 'EAT']);
  });

  it('uses fuzzy matching only as a fallback and not for short words', async () => {
    expect(glosses(await run('watter please'))).toEqual(['WATER', 'PLEASE']);
    expect((await run('hell')).words).toEqual([]); // must NOT fuzzy-match HELLO
  });

  it('flags unmatched words explicitly instead of dropping them', async () => {
    const a = await run('where is the bathroom');
    expect(a.words).toEqual([]);
    expect(a.unmatched.map((u) => u.text)).toEqual(['where', 'bathroom']);
    const b = await run('I want a sandwich');
    expect(glosses(b)).toEqual(['I', 'WANT']);
    expect(b.unmatched.map((u) => u.text)).toEqual(['sandwich']);
    // annotated transcript keeps every word
    const words = b.parts.filter((p) => p.type === 'word');
    expect(words.map((p) => p.text)).toEqual(['I', 'want', 'a', 'sandwich']);
    expect(words.find((p) => p.text === 'a').role).toBe('function');
    expect(words.find((p) => p.text === 'sandwich').role).toBe('unmatched');
  });

  it('collapses consecutive duplicates', async () => {
    expect(glosses(await run('thanks, thank you'))).toEqual(['THANK YOU']);
  });
});

describe('sentence type -> non-manual marker', () => {
  it('detects questions', () => {
    expect(detectSentenceType('Do you want water?').type).toBe('question');
    expect(detectSentenceType('do you want water').type).toBe('question'); // aux inversion, no "?"
    const wh = detectSentenceType('Where is my mother');
    expect(wh.type).toBe('question'); expect(wh.wh).toBe(true);
  });
  it('detects negation and imperatives', () => {
    expect(detectSentenceType("I don't want water").type).toBe('negation');
    expect(detectSentenceType('I cannot eat').negated).toBe(true);
    expect(detectSentenceType('Please help me').type).toBe('imperative');
    expect(detectSentenceType('No').type).toBe('statement'); // the sign NO, not a marker
    expect(detectSentenceType('I want water').type).toBe('statement');
  });
  it('turns type into expression + head', async () => {
    expect((await run('Do you want water?')).marker).toMatchObject({ type: 'question', E: 'E09', HD: null });
    expect((await run('Where is mom?')).marker.E).toBe('E06'); // wh -> furrowed brow
    expect((await run("I don't want water")).marker).toMatchObject({ type: 'negation', E: 'E04', HD: 'HD04' });
    expect((await run('I want water')).marker).toMatchObject({ E: null, HD: null });
  });
});

describe('AI tier + fallback (same interface)', () => {
  it('maps AI concepts through the shared matcher and reports unmatched concepts', async () => {
    const api = { post: async () => ({ concepts: ['want', 'water', 'bathroom'] }) };
    const a = await run('whatever', { useAi: true, api });
    expect(a.tier).toBe('ai');
    expect(glosses(a)).toEqual(['WANT', 'WATER']);
    expect(a.unmatched).toEqual([{ text: 'bathroom' }]);
  });
  it('falls back to the deterministic tier when the AI tier fails', async () => {
    const api = { post: async () => { throw new Error('503'); } };
    const a = await run('I want water', { useAi: true, api });
    expect(a.tier).toBe('deterministic');
    expect(a.fellBack).toBe(true);
    expect(glosses(a)).toEqual(['I', 'WANT', 'WATER']);
  });
  it('falls back when the AI returns nothing', async () => {
    const api = { post: async () => ({ concepts: [] }) };
    expect((await run('I want water', { useAi: true, api })).fellBack).toBe(true);
  });
});
