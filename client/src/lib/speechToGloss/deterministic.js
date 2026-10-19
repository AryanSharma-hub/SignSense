import { tokenizeRaw, expandWord, FUNCTION_WORDS, NEGATION_TOKENS, WH_WORDS } from './nlp.js';
import { matchPhrase, matchSingle, matchTerm, MIN_SCORE } from './matcher.js';

const IS_DIGITS = (w) => /^[0-9]+$/.test(w);

/** Number words with no sign of their own are fingerspelled as digits (ASL number handshapes). */
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * A word is fingerspelled, not dropped as unmatched, when it's a pure number (any length —
 * "5", "120", a street address, a phone number) OR it looks like a proper noun: capitalized
 * in the ORIGINAL transcript. WH-words (where/who/...) are excluded explicitly rather than
 * by sentence position, so a lone name or a name that opens the sentence ("Sarah", "My name
 * is Sarah") still spells correctly, while "Where is the bathroom" still leaves "Where"
 * alone. Real ASL fingerspells names, places and novel terms, not every ordinary word it
 * happens not to have a sign for — this keeps that distinction without being position-shy.
 */
function looksSpellable(norm, raw) {
  if (IS_DIGITS(norm)) return true;
  if (WH_WORDS.has(norm)) return false;
  return /^[A-Z]/.test(raw ?? '');
}

/**
 * Deterministic tier: stopword removal + lemma/stem extraction + gesture_keywords matching.
 * Works fully offline. Returns matches IN SENTENCE ORDER, the words it could not match,
 * and an annotated transcript (`parts`) so nothing is ever dropped silently.
 */
export function extractDeterministic(transcript, index, { autoFingerspell = true } = {}) {
  const words = tokenizeRaw(transcript);
  const T = [];
  words.forEach((w, rawIdx) => expandWord(w.raw).forEach((norm) => T.push({ norm, rawIdx })));

  const slot = new Array(T.length).fill(null); // {kind:'match', m} | {kind:'marker'|'function'|'unmatched'}
  const found = []; // {m, tokenStart, tokenEnd}

  // 1) phrases first, longest first ("can i have", "would like", "thank you")
  for (let n = 3; n >= 2; n--) {
    for (let i = 0; i + n <= T.length; i++) {
      if (slot.slice(i, i + n).some(Boolean)) continue;
      const m = matchPhrase(index, T.slice(i, i + n).map((t) => t.norm).join(' '));
      if (m && m.score >= MIN_SCORE) {
        const rec = { m, tokenStart: i, tokenEnd: i + n - 1 };
        for (let k = i; k < i + n; k++) slot[k] = { kind: 'match', rec };
        found.push(rec);
      }
    }
  }
  // 2) single words
  for (let i = 0; i < T.length; i++) {
    if (slot[i]) continue;
    const w = T[i].norm;
    const m = matchSingle(index, w);
    if (m && m.score >= MIN_SCORE) {
      const rec = { m, tokenStart: i, tokenEnd: i };
      slot[i] = { kind: 'match', rec };
      found.push(rec);
    } else if (NEGATION_TOKENS.has(w)) slot[i] = { kind: 'marker' };
    else if (FUNCTION_WORDS.has(w)) slot[i] = { kind: 'function' };
    else if (autoFingerspell && NUMBER_WORDS[w] != null) {
      const rec = { m: { entry: { gestureId: null, gloss: String(NUMBER_WORDS[w]) }, via: 'spelled', score: 1 }, tokenStart: i, tokenEnd: i };
      slot[i] = { kind: 'spelled', rec };
      found.push(rec);
    } else if (autoFingerspell && looksSpellable(w, words[T[i].rawIdx]?.raw)) {
      const rec = { m: { entry: { gestureId: null, gloss: words[T[i].rawIdx].raw.toUpperCase() }, via: 'spelled', score: 1 }, tokenStart: i, tokenEnd: i };
      slot[i] = { kind: 'spelled', rec };
      found.push(rec);
    } else slot[i] = { kind: 'unmatched' };
  }

  found.sort((a, b) => a.tokenStart - b.tokenStart);
  const matches = found.map(({ m, tokenStart, tokenEnd }) => ({
    gestureId: m.entry.gestureId, gloss: m.entry.gloss, via: m.via, score: m.score,
    source: words.slice(T[tokenStart].rawIdx, T[tokenEnd].rawIdx + 1).map((w) => w.raw).join(' '),
  }));

  // Roll token slots up to the raw words the person actually said.
  const roles = words.map(() => ({ role: 'function', rec: null }));
  const rank = { function: 0, marker: 1, unmatched: 2, matched: 3, spelled: 3 };
  T.forEach((t, i) => {
    const s = slot[i];
    const role = s.kind === 'match' ? 'matched' : s.kind;
    if (rank[role] > rank[roles[t.rawIdx].role]) roles[t.rawIdx] = { role, rec: s.rec || null };
  });

  const parts = [];
  let cursor = 0;
  words.forEach((w, i) => {
    if (w.start > cursor) parts.push({ type: 'gap', text: transcript.slice(cursor, w.start) });
    const { role, rec } = roles[i];
    const gloss = rec ? rec.m.entry.gloss : null;
    const lastRaw = rec ? T[rec.tokenEnd].rawIdx : null;
    parts.push({ type: 'word', text: w.raw, role, gloss, groupEnd: !!rec && lastRaw === i });
    cursor = w.end;
  });
  if (cursor < transcript.length) parts.push({ type: 'gap', text: transcript.slice(cursor) });

  const unmatched = words.filter((_, i) => roles[i].role === 'unmatched').map((w) => ({ text: w.raw }));
  return { matches, unmatched, parts };
}

/**
 * Map AI-extracted concept keywords through the SAME matcher — mapping is shared by both
 * tiers. The AI tier's concepts arrive lowercased (case is already lost upstream), so the
 * proper-noun capitalization heuristic doesn't apply here — only pure-digit concepts are
 * auto-spelled; everything else falls back to unmatched, same as before.
 */
export function matchConcepts(concepts, index, { autoFingerspell = true } = {}) {
  const matches = [], unmatched = [];
  for (const c of concepts) {
    const m = matchTerm(index, c);
    if (m) matches.push({ gestureId: m.entry.gestureId, gloss: m.entry.gloss, via: 'ai', score: m.score, source: c });
    else if (autoFingerspell && IS_DIGITS(String(c).trim())) {
      matches.push({ gestureId: null, gloss: String(c).trim(), via: 'spelled', score: 1, source: c });
    } else unmatched.push({ text: c });
  }
  return { matches, unmatched, parts: null };
}
