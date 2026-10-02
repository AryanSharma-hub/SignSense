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
