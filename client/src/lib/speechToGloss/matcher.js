import { stem, lemma, levenshtein } from './nlp.js';

/**
 * keyword -> gesture mapping against gesture_keywords.
 * Order of attempts: exact (phrase, then word) -> irregular/stem -> fuzzy fallback.
 */
export const MIN_SCORE = 0.4;
const VIA_MULT = { exact: 1, phrase: 1, lemma: 0.95, stem: 0.85, fuzzy: 0.6, ai: 1 };

const push = (map, key, val) => { const l = map.get(key); if (l) l.push(val); else map.set(key, [val]); };
const best = (list) => list.reduce((a, b) => (b.weight > a.weight ? b : a));

/** Build lookup structures from the gestures returned by /api/gestures. */
export function buildKeywordIndex(gestures) {
  const exact = new Map(), stems = new Map(), singles = [];
  const add = (g, keyword, weight) => {
    const k = String(keyword).toLowerCase().trim();
    if (!k) return;
    const entry = { gestureId: g.id, gloss: g.gloss, keyword: k, weight };
    push(exact, k, entry);
    if (!k.includes(' ')) { push(stems, stem(k), entry); singles.push(entry); }
  };
  for (const g of gestures) {
    add(g, g.gloss, 1); // a gloss is always a keyword of itself
    for (const kw of g.keywords || []) add(g, kw.keyword, kw.weight ?? 1);
  }
  return { exact, stems, singles, gestureById: new Map(gestures.map((g) => [g.id, g])) };
}

const hit = (entry, via) => ({ entry, via, score: entry.weight * VIA_MULT[via] });

/** A multi-word phrase, exact only ("would like", "thank you"). */
export function matchPhrase(index, phrase) {
  const list = index.exact.get(phrase);
  return list ? hit(best(list), 'phrase') : null;
}

/** One word: exact -> irregular lemma -> stem -> fuzzy. */
export function matchSingle(index, word) {
  const w = word.toLowerCase();
  let list = index.exact.get(w);
  if (list) return hit(best(list), 'exact');
  const l = lemma(w);
  list = l !== w && index.exact.get(l);
  if (list) return hit(best(list), 'lemma');
  list = index.stems.get(stem(w));
  if (list) return hit(best(list), 'stem');
  if (w.length >= 5) {
    const maxDist = w.length >= 8 ? 2 : 1;
    let bestFuzzy = null;
    for (const e of index.singles) {
      if (e.keyword.length < 5 || e.keyword[0] !== w[0]) continue;
      if (Math.abs(e.keyword.length - w.length) > maxDist) continue;
      const d = levenshtein(w, e.keyword);
      if (d <= maxDist && (!bestFuzzy || d < bestFuzzy.d || (d === bestFuzzy.d && e.weight > bestFuzzy.e.weight))) bestFuzzy = { e, d };
    }
    if (bestFuzzy) return hit(bestFuzzy.e, 'fuzzy');
  }
  return null;
}

/** Concept from the AI tier: a phrase or a single word. */
export function matchTerm(index, term) {
  const t = String(term).toLowerCase().trim();
  if (!t) return null;
  const m = t.includes(' ') ? (matchPhrase(index, t) || matchSingle(index, t.split(/\s+/).pop())) : matchSingle(index, t);
  return m && m.score >= MIN_SCORE ? m : null;
}
