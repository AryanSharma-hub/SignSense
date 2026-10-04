/**
 * Turns the curated word lists (bulkWords.js) into full gesture entries. Parameter
 * assignment is deterministic (a hash of the word picks indices into the expanded
 * vocab) but linguistically arbitrary — same "draft scaffold" status as the rest of
 * the dataset (needs_review defaults true). The value here is real, common,
 * deduplicated English vocabulary with working search/keyword plumbing, not hand-tuned
 * ASL correctness; that still needs an ASL-fluent reviewer, same as everything else.
 *
 * Every entry is a single step (one simultaneous pose) — multi-step authoring stays a
 * hand-crafted thing for the curated set, where it actually illustrates something.
 */
import { CATEGORIES } from './bulkWords.js';

/** Words that real tests rely on staying unmatched/undefined — never generate these
 * (also applied to the ASL-LEX import — see aslLex/index.js). */
export const EXCLUDE_GLOSSES = new Set(['BATHROOM', 'WHERE', 'SANDWICH']);

/**
 * Pure function/grammar words — mirrors client/src/lib/speechToGloss/nlp.js's
 * FUNCTION_WORDS/NEGATION_TOKENS/WH_WORDS (duplicated as plain data here since server
 * and client are separate workspace packages). A keyword match runs BEFORE the
 * matcher's own grammar-word check, so if one of these became a gesture it would
 * silently bypass that check and start getting signed in every sentence that uses it
 * — never generate a gesture for one. Also applied to the ASL-LEX import.
 *
 * NOTE: "my"/"your"/"his"/"our"/"mine"/"us" are deliberately NOT here even though they're
 * grammatical — ASL-LEX confirms real ASL signs exist for them (a signer really does sign
 * MY/YOUR/OUR), so they're allowed through as real vocabulary; the still-grammar-only
 * "her"/"their"/"yours"/"ours"/"theirs"/"him"/"them" aren't in ASL-LEX at all, so excluding
 * them here is just belt-and-suspenders, not load-bearing.
 */
export const GRAMMAR_WORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'about', 'as', 'into',
  'than', 'that', 'this', 'these', 'those', 'there', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'would', 'could', 'should', 'will', 'shall', 'can', 'may', 'might', 'must',
  'it', 'its', 'and', 'or', 'but', 'if', 'so', 'then', 'than', 'nor', 'thus',
  'her', 'their', 'yours', 'ours', 'theirs', 'him', 'them',
  'not', 'never', 'cannot',
  // NOTE: WH-words (what/when/why/which/how/...) are deliberately NOT here — real ASL
  // has dedicated signs for them, and the 'question-words' category in bulkWords.js
  // already adds several as real gestures. "where"/"who" stay out via EXCLUDE_GLOSSES
  // / simply not being in that category, not via a blanket word-class exclusion here.
  'each', 'every', 'all', 'both', 'most', 'many', 'much', 'such', 'own', 'very', 'just', 'only', 'too', 'also',
  'out', 'up', 'down', 'over', 'under', 'off', 'again', 'once', 'while', 'until', 'since', 'though', 'although',
  'either', 'except', 'perhaps', 'quite', 'else', 'rather', 'yet', 'well', 'through', 'about', 'side', 'part',
]);

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(list, h, shift) {
  return list[Math.floor(h / 2 ** shift) % list.length];
}

function buildSignForm(gloss, vocab) {
  const h = hashStr(gloss);
  return [{
    E: pick(vocab.expressions, h, 0).id,
    H: { right: pick(vocab.hands, h, 2).id, left: null },
    M: { right: pick(vocab.movements, h, 5).id, left: null },
    HD: pick(vocab.heads, h, 8).id,
    L: pick(vocab.locations, h, 10).id,
    together: [],
  }];
}

/**
 * @param vocab {expressions,hands,movements,heads,locations} — the non-fingerspelling
 *   parameter vocab (vocabParams.js), so generated gestures never draw a fingerspelling
 *   handshape.
 * @param higherPriorityGestures every gesture already placed by a higher-priority source
 *   (the 16 hand-authored curated signs, then the ASL-LEX import) — both their glosses
 *   AND every one of their keyword synonyms are off-limits to new entries, so a bulk word
 *   can never create an ambiguous second claim on a keyword like "great" (already a GOOD
 *   synonym) or on a gloss ASL-LEX already covers with real phonological data.
 * @returns gesture entries, strictly additive and deduplicated against those sources,
 *   EXCLUDE_GLOSSES, GRAMMAR_WORDS, and each other.
 */
export function buildBulkGestures(vocab, higherPriorityGestures) {
  const usedGlosses = new Set([...higherPriorityGestures.map((g) => g.gloss), ...EXCLUDE_GLOSSES]);
  const usedKeywords = new Set(higherPriorityGestures.flatMap((g) => g.keywords.map(([k]) => k.toLowerCase())));
  const out = [];
  for (const [category, pos, words] of CATEGORIES) {
    for (const word of words) {
      const w = word.toLowerCase();
      const gloss = word.toUpperCase();
      if (GRAMMAR_WORDS.has(w)) continue;
      if (usedGlosses.has(gloss) || usedKeywords.has(w)) continue; // dedupe against curated set + earlier categories
      usedGlosses.add(gloss);
      usedKeywords.add(w);
      out.push({
        gloss, pos, english: word, category,
        meaning: `${word.charAt(0).toUpperCase()}${word.slice(1)}.`,
        signForm: buildSignForm(gloss, vocab),
        keywords: [[word, 1]],
      });
    }
  }
  return out;
}
