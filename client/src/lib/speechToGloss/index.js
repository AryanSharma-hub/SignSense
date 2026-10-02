import { runTiered } from '../tiered.js';
import { markerFor } from '../nonManual.js';
import { detectSentenceType } from './sentenceType.js';
import { extractDeterministic, matchConcepts } from './deterministic.js';
import { extractConceptsAi } from './aiTier.js';

/** Consecutive repeats of the same sign collapse ("thanks, thank you" -> one THANK YOU). */
function collapse(matches) {
  return matches.filter((m, i) => i === 0 || m.gloss !== matches[i - 1].gloss);
}

/**
 * speechToGloss — hearing user's text -> the same signForm objects Direction A renders.
 *
 *   1. sentence type (rules) -> non-manual marker (expression + head)
 *   2. concept extraction     (deterministic default | optional AI tier)
 *   3. keyword -> gesture mapping (shared)
 *   4. explicit unmatched words — never dropped silently
 *
 * @returns analysis {transcript, sentenceType, marker, words[], unmatched[], parts|null, tier, fellBack}
 */
export async function speechToGloss(transcript, { index, vocab, useAi = false, api } = {}) {
  const clean = String(transcript || '').trim();
  const sentenceType = detectSentenceType(clean);
  const marker = markerFor(sentenceType, vocab);

  const res = await runTiered({
    useAi: useAi && !!api,
    deterministic: async () => extractDeterministic(clean, index),
    ai: async () => matchConcepts(await extractConceptsAi(clean, api), index),
  });
  const { matches, unmatched, parts } = res.value;

  const words = collapse(matches).map((m) => {
    const g = index.gestureById.get(m.gestureId);
    return { gloss: g.gloss, gestureId: g.id, signForm: g.signForm, via: m.via, score: m.score, source: m.source, needsReview: !!g.needsReview };
  });
  return {
    transcript: clean, sentenceType, marker, words, unmatched,
    parts: res.tier === 'deterministic' ? parts : null,
    tier: res.tier, fellBack: res.fellBack, error: res.error,
  };
}

export { detectSentenceType };
