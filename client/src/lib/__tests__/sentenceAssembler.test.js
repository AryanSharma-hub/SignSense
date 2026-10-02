import { describe, it, expect } from 'vitest';
import { sentenceAssembler } from '../sentenceAssembler/index.js';
import { gestures } from './helpers.js';

const word = (gloss) => gestures.find((g) => g.gloss === gloss);
const say = (glosses, type = 'statement', extra = {}) =>
  sentenceAssembler({ words: glosses.map(word), marker: { type, ...extra } }).then((r) => r.text);

describe('deterministic sentence assembly', () => {
  it('builds simple statements', async () => {
    expect(await say(['HELLO'])).toBe('Hello.');
    expect(await say(['WANT', 'WATER'])).toBe('I want water.');
    expect(await say(['I', 'WANT', 'WATER'])).toBe('I want water.');
    expect(await say(['WATER', 'WANT'])).toBe('I want water.'); // topic-comment order
    expect(await say(['I', 'LOVE', 'MOTHER'])).toBe('I love mother.');
    expect(await say(['I', 'WANT', 'EAT'])).toBe('I want to eat.');
    expect(await say(['WATER', 'MORE'])).toBe('More water.');
  });
  it('groups interjections with commas', async () => {
    expect(await say(['NO', 'THANK YOU'])).toBe('No, thank you.');
    expect(await say(['HELLO', 'I', 'WANT', 'WATER'])).toBe('Hello, I want water.');
    expect(await say(['MORE', 'WATER', 'PLEASE'])).toBe('More water, please.');
  });
  it('turns the face/head marker into grammar', async () => {
    expect(await say(['WANT', 'WATER'], 'question')).toBe('Do you want water?');
    expect(await say(['I', 'WANT', 'WATER'], 'question')).toBe('Can I have water?');
    expect(await say(['HELP'], 'question')).toBe('Can you help?');
    expect(await say(['WANT', 'WATER'], 'negation')).toBe('I do not want water.');
    expect(await say(['GOOD'], 'negation')).toBe('Not good.');
    expect(await say(['WATER'], 'negation')).toBe('No water.');
    expect(await say(['WATER'], 'question')).toBe('Water?');
  });
  it('reads bare HELP as a call for help', async () => {
    expect(await say(['HELP'])).toBe('Help!');
  });
  it('is tiered: AI on -> AI text; AI failing -> deterministic fallback', async () => {
    const input = { words: [word('WANT'), word('WATER')], marker: { type: 'statement' } };
    const ok = await sentenceAssembler(input, { useAi: true, api: { post: async () => ({ text: 'I would like some water.' }) } });
    expect(ok).toMatchObject({ text: 'I would like some water.', tier: 'ai' });
    const bad = await sentenceAssembler(input, { useAi: true, api: { post: async () => { throw new Error('down'); } } });
    expect(bad).toMatchObject({ text: 'I want water.', tier: 'deterministic', fellBack: true });
  });
});
