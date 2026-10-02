/**
 * Small, dependency-free English helpers for the deterministic tier.
 * (A library like `compromise` can replace lemma()/stem() behind the same functions.)
 */

export const WH_WORDS = new Set(['what', 'where', 'when', 'why', 'who', 'whom', 'whose', 'which', 'how']);
export const NEGATION_TOKENS = new Set(['not', 'never', 'cannot']);

/** Function words carry grammar, not a concept — safe to leave unsigned. */
export const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'about', 'as', 'into',
  'than', 'that', 'this', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does',
  'did', 'would', 'could', 'should', 'will', 'shall', 'can', 'may', 'might', 'must', 'it', 'its', 'and', 'or', 'um',
  'uh', 'oh', 'ah', 'hmm', 'well',
]);

const AUX_START = new Set(['do', 'does', 'did', 'is', 'are', 'am', 'was', 'were', 'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'have', 'has', 'had']);
const SUBJECT_PRONOUNS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'there', 'this', 'that', 'anyone', 'someone', 'somebody', 'anybody']);
const IMPERATIVE_VERBS = new Set(['give', 'bring', 'come', 'go', 'stop', 'wait', 'help', 'look', 'let', 'tell', 'show', 'take', 'get', 'call', 'sit', 'stand', 'listen', 'eat', 'drink', 'open', 'close', 'turn', 'put', 'hold', 'try', 'say', 'ask', 'pass', 'send']);
export const isAuxStart = (w, next) => AUX_START.has(w) && SUBJECT_PRONOUNS.has(next);
export const isImperativeVerb = (w) => IMPERATIVE_VERBS.has(w);

const IRREGULAR_CONTRACTIONS = {
  "can't": ['can', 'not'], "won't": ['will', 'not'], "shan't": ['shall', 'not'], "ain't": ['is', 'not'],
  "let's": ['let', 'us'], cannot: ['can', 'not'],
};
const CLITIC = { re: 'are', ll: 'will', ve: 'have', m: 'am', d: 'would', s: 'is' };

/** Split raw text into words, keeping positions so the transcript can be annotated. */
export function tokenizeRaw(text) {
  const out = [];
  const re = /[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** "I'd" -> ["i","would"], "don't" -> ["do","not"], "water" -> ["water"]. */
export function expandWord(raw) {
  const w = String(raw).toLowerCase().replace(/[’‘]/g, "'");
  if (IRREGULAR_CONTRACTIONS[w]) return IRREGULAR_CONTRACTIONS[w];
  let m = w.match(/^(.+)n't$/);
  if (m) return [m[1], 'not'];
  m = w.match(/^(.+)'(re|ll|ve|m|d|s)$/);
  if (m) return [m[1], CLITIC[m[2]]];
  return [w.replace(/'/g, '')];
}

const IRREGULAR = {
  ate: 'eat', eaten: 'eat', went: 'go', gone: 'go', gave: 'give', given: 'give', drank: 'drink', drunk: 'drink',
  came: 'come', took: 'take', taken: 'take', got: 'get', gotten: 'get', had: 'have', made: 'make', said: 'say',
  saw: 'see', seen: 'see', knew: 'know', known: 'know', felt: 'feel', thought: 'think', told: 'tell',
  brought: 'bring', bought: 'buy', found: 'find', left: 'leave', kept: 'keep', met: 'meet', ran: 'run',
  sat: 'sit', stood: 'stand', wrote: 'write', written: 'write', spoke: 'speak', better: 'good', best: 'good',
  children: 'child', people: 'person', men: 'man', women: 'woman', mothers: 'mother', fathers: 'father',
};

/** Irregular forms only; regular inflection is handled by stem(). */
export const lemma = (w) => IRREGULAR[w] || w;

/** Light suffix stripper (Porter-lite): "eating"/"eats"/"eaten" -> same stem as "eat". */
export function stem(word) {
  let w = lemma(String(word).toLowerCase());
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ly')) w = w.slice(0, -2);
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}
