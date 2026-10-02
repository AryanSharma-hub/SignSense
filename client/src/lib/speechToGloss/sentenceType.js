import { tokenizeRaw, expandWord, WH_WORDS, NEGATION_TOKENS, isAuxStart, isImperativeVerb } from './nlp.js';

/**
 * Classify the hearing user's sentence with lightweight rules BEFORE keyword extraction.
 * The result becomes the non-manual marker on the signForm — the mirror image of
 * Direction A's rule that facial expression carries grammar. The sentence type is
 * carried by the face and head instead of being dropped.
 *
 *   question   '?' at the end, a wh-word first, or auxiliary + subject inversion
 *   negation   not / never / n't / cannot anywhere ("no" alone is the sign NO, not a marker)
 *   imperative sentence starts with a base-form command verb
 *   statement  everything else
 *
 * @returns {{type:'question'|'negation'|'imperative'|'statement', wh:boolean, negated:boolean}}
 */
export function detectSentenceType(text) {
  const raw = String(text || '').trim();
  const words = tokenizeRaw(raw).map((w) => w.raw.toLowerCase().replace(/[’‘]/g, "'"));
  const flat = words.flatMap(expandWord);
  const negated = flat.some((t) => NEGATION_TOKENS.has(t));

  const first = words[0];
  const startsWh = WH_WORDS.has(first);
  const endsQ = /\?\s*$/.test(raw);
  const invertedAux = !!first && isAuxStart(first, words[1]);
  const question = endsQ || startsWh || invertedAux;
  const wh = question && (startsWh || words.some((w) => WH_WORDS.has(w)));

  const lead = first === 'please' ? words[1] : first;
  const imperative = !question && (isImperativeVerb(lead) || (first === 'do' && words[1] === 'not') || first === "don't");

  const type = question ? 'question' : imperative ? 'imperative' : negated ? 'negation' : 'statement';
  return { type, wh, negated };
}
