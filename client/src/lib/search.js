import { byId } from './vocabulary.js';
import { flattenStepsFlat } from './steps.js';

/** Weighted parallel search over the five parameters. */
export const WEIGHTS = { E: 0.15, H: 0.3, M: 0.25, HD: 0.15, L: 0.15 };
const NEUTRAL_LOCATION = 'L01';

export function sim(vocab, key, a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = byId(vocab, key, a), B = byId(vocab, key, b);
  if (A && B && A.family === B.family) return 0.55;
  return 0.12;
}

export function scoreGesture(query, gestureFlat, vocab) {
  const filled = Object.keys(query).filter((k) => query[k]);
  if (filled.length === 0) return { score: 0, exact: false };
  const gestureParamCount = Object.keys(gestureFlat).filter((k) => gestureFlat[k]).length;
  let wsum = 0, score = 0, allEqual = true;
  for (const k of filled) {
    const gv = k === 'L' ? (gestureFlat.L || NEUTRAL_LOCATION) : gestureFlat[k];
    wsum += WEIGHTS[k];
    score += WEIGHTS[k] * sim(vocab, k, query[k], gv);
    if (gv !== query[k]) allEqual = false;
  }
  return { score: score / wsum, exact: allEqual && filled.length >= gestureParamCount };
}

export function searchGestures(query, gestures, vocab) {
  return gestures
    .map((g) => {
      const s = scoreGesture(query, g.flat || flattenStepsFlat(g.signForm), vocab);
      return { ...g, score: s.score, exact: s.exact };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Why a gesture matched a parameter query: for each parameter the query sets, whether
 * the gesture has the same value, one from the same family, or something different.
 */
export function explainMatch(query, gestureFlat, vocab) {
  return Object.keys(WEIGHTS).filter((k) => query[k]).map((k) => {
    const gv = k === 'L' ? (gestureFlat.L || NEUTRAL_LOCATION) : gestureFlat[k];
    const s = sim(vocab, k, query[k], gv);
    return { k, kind: s === 1 ? 'same' : s > 0.5 ? 'similar' : 'different' };
  });
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Word search over the library: gloss, keywords and meaning, each match labelled with
 * the reason it matched. Exact names rank first; nothing is returned for unrelated text.
 * @returns {Array<{gesture, score:number, reason:string, exact:boolean}>}
 */
export function searchText(text, gestures, limit = 20) {
  const q = norm(text);
  if (!q) return [];
  const out = [];
  for (const g of gestures) {
    const gloss = norm(g.gloss);
    const kws = (g.keywords || []).map((k) => norm(typeof k === 'string' ? k : k.keyword));
    let score = 0, reason = '';
    const take = (s, r) => { if (s > score) { score = s; reason = r; } };
    if (gloss === q) take(1, 'Exact sign name');
    else if (kws.includes(q)) take(0.9, `Keyword “${q}”`);
    else {
      if (gloss.startsWith(q)) take(0.8, 'Sign name starts with this');
      else if (gloss.split(' ').includes(q)) take(0.75, 'Word in the sign name');
      else if (gloss.includes(q)) take(0.6, 'Sign name contains this');
      const kw = kws.find((k) => k.startsWith(q));
      if (kw) take(0.55, `Keyword “${kw}”`);
      if (q.length >= 3 && norm(g.meaning).split(' ').includes(q)) take(0.45, 'Mentioned in the meaning');
    }
    if (score > 0) out.push({ gesture: g, score, reason, exact: score === 1 });
  }
  return out.sort((a, b) => b.score - a.score || a.gesture.gloss.length - b.gesture.gloss.length).slice(0, limit);
}
