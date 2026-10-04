import { blankStep } from './steps.js';
import { byId } from './vocabulary.js';

/** 'A'->'HLA' (letter), '3'->'HN3' (digit), anything else -> null. Shared id convention
 * with server/src/db/seedData/fingerspellHands.js — ids are plain data, not re-derived. */
export function letterHandId(ch) {
  const c = String(ch).toUpperCase();
  if (/^[A-Z]$/.test(c)) return `HL${c}`;
  if (/^[0-9]$/.test(c)) return `HN${c}`;
  return null;
}

/** True once the vocab has at least one fingerspelling handshape loaded. */
export function canSpell(vocab) {
  return (vocab?.hands || []).some((h) => h.family === 'fingerspell-letter' || h.family === 'fingerspell-digit');
}

/**
 * Builds a synthetic word directly from the letter/digit hand vocabulary — no `gestures`
 * row involved, so spelling never grows the dataset. One step per character (a flat
 * sequence of single-hand poses); non-alphanumeric characters are skipped.
 */
export function spellWord(word, vocab) {
  const chars = String(word).toUpperCase().split('').filter((ch) => /[A-Z0-9]/.test(ch));
  const signForm = chars
    .map((ch) => letterHandId(ch))
    .filter((id) => byId(vocab, 'H', id))
    .map((id) => ({ ...blankStep(), H: { right: id, left: null } }));
  return { gloss: chars.join(''), signForm };
}
