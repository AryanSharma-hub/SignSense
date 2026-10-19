/**
 * The 16 core conversation signs. Their PHONOLOGY (handshape, sign type, movement,
 * locations, handshape change) is not hand-written: it is built from each sign's ASL-LEX
 * 2.0 entry by the same mapping as every other ASL-LEX sign, so it cannot drift from the
 * source. What is curated here is only what ASL-LEX does not record:
 *   - keywords: English words and phrases that ASL signs WITH THIS SAME SIGN (never words
 *     that have their own, different sign — e.g. "drink" is not WATER, "need" is not WANT)
 *   - non-manual markers that are part of the citation form (the nod in YES, the
 *     headshake in NO) or that carry its usual affect (a soft smile on THANK YOU)
 *
 * The first versions of these 16 were drawn by hand and several were wrong against the
 * ASL-LEX coding (YES was two open palms instead of a nodding S-hand, PLEASE used both
 * hands, WANT used one claw hand, …) — see server/src/db/VOCABULARY_REPORT.md.
 */
import { groupMeanings, stepsFromRow } from './aslLex/index.js';
import { SAME_SIGN_SYNONYMS } from './wordLists.js';

const CURATED = [
  { gloss: 'HELLO', lemma: 'hello', pos: 'interj', english: 'hello', meaning: 'A friendly greeting: a flat hand salutes outward from the forehead.',
    // together: the handshape and its place at the forehead are deliberately linked — a
    // demonstration of the explicit pairing feature.
    first: { E: 'E02', together: [['H', 'L']] },
    keywords: [['hello', 1], ['hi', 1], ['hey', 0.8], ['greetings', 0.6], ['howdy', 0.5]] },
  { gloss: 'THANK YOU', lemma: 'thank_you', pos: 'interj', english: 'thank you', meaning: 'An expression of gratitude: a flat hand moves outward from the mouth.',
    first: { E: 'E02', HD: 'HD03' },
    keywords: [['thank you', 1], ['thanks', 1], ['thank', 1]] },
  { gloss: 'YES', lemma: 'yes', pos: 'interj', english: 'yes', meaning: 'An affirmative answer: a fist nods up and down, like a nodding head.',
    first: { HD: 'HD02' },
    keywords: [['yes', 1], ['yeah', 0.9], ['yep', 0.9], ['yup', 0.9]] },
  { gloss: 'NO', lemma: 'no', pos: 'interj', english: 'no', meaning: 'A negative answer: index and middle fingers snap shut onto the thumb.',
    first: { HD: 'HD04' },
    keywords: [['no', 1], ['nope', 0.9], ['nah', 0.9]] },
  { gloss: 'LOVE', lemma: 'love', pos: 'verb', english: 'love', meaning: 'Deep affection: fists cross over the chest, hugging it.',
    first: { E: 'E05' },
    keywords: [['love', 1]] },
  { gloss: 'HELP', lemma: 'help', pos: 'verb', english: 'help', meaning: 'Assistance: a fist rests on the flat palm of the other hand and lifts.',
    keywords: [['help', 1], ['assist', 0.9], ['aid', 0.7]] },
  { gloss: 'WATER', lemma: 'water', pos: 'noun', english: 'water', meaning: 'Water: a W-hand taps the chin.',
    keywords: [['water', 1]] },
  { gloss: 'PLEASE', lemma: 'please', pos: 'interj', english: 'please', meaning: 'A polite request: one flat hand circles on the chest.',
    first: { E: 'E08' },
    keywords: [['please', 1]] },
  { gloss: 'I', lemma: 'me', pos: 'pronoun', english: 'I', meaning: 'First-person self-reference (I / me): the index finger points to the chest.',
    keywords: [['i', 1], ['me', 1]] },
  { gloss: 'YOU', lemma: 'you', pos: 'pronoun', english: 'you', meaning: 'Second-person reference: point toward the person addressed.',
    keywords: [['you', 1]] },
  { gloss: 'WANT', lemma: 'want', pos: 'verb', english: 'want', meaning: 'A desire for something: both open hands draw in toward the body.',
    keywords: [['want', 1], ['wanna', 0.9], ['would like', 0.9], ['can i have', 0.7], ['could i have', 0.7], ['may i have', 0.7]] },
  { gloss: 'GOOD', lemma: 'good', pos: 'adj', english: 'good', meaning: 'Approval or a positive quality: a flat hand moves forward from the chin.',
    first: { E: 'E02' },
    keywords: [['good', 1]] },
  { gloss: 'MORE', lemma: 'more', pos: 'adv', english: 'more', meaning: 'An additional amount: the fingertips of both O-hands tap together.',
    keywords: [['more', 1]] },
  { gloss: 'EAT', lemma: 'eat', pos: 'verb', english: 'eat', meaning: 'Eating, or food: closed fingertips tap the mouth.',
    keywords: [['eat', 1]] },
  // MOTHER / FATHER differ ONLY by location (chin vs forehead) — the reason the location parameter exists.
  { gloss: 'MOTHER', lemma: 'mother', pos: 'noun', english: 'mother', meaning: 'A female parent: the thumb of an open hand taps the chin.',
    keywords: [['mother', 1], ['mom', 1], ['mum', 1], ['mama', 0.9], ['mommy', 0.9]] },
  { gloss: 'FATHER', lemma: 'father', pos: 'noun', english: 'father', meaning: 'A male parent: the thumb of an open hand taps the forehead.',
    keywords: [['father', 1], ['dad', 1], ['papa', 0.9], ['daddy', 0.9]] },
];

/** Build the curated entries from ASL-LEX. Throws if a referenced lemma is missing — a data bug. */
export function buildCuratedGestures() {
  const primary = new Map(groupMeanings().filter((m) => m.primary).map((m) => [m.word, m]));
  return CURATED.map((c) => {
    const m = primary.get(c.lemma);
    if (!m) throw new Error(`curated ${c.gloss}: ASL-LEX lemma "${c.lemma}" not found`);
    const steps = stepsFromRow(m.rows[0]);
    const signForm = steps.map((s, i) => (i === 0 ? { ...s, ...(c.first || {}) } : s));
    const keywords = [...c.keywords];
    for (const [syn, lemma] of Object.entries(SAME_SIGN_SYNONYMS)) {
      if (lemma === c.lemma && !keywords.some(([k]) => k === syn)) keywords.push([syn, 0.95]);
    }
    return {
      gloss: c.gloss, pos: c.pos, english: c.english, meaning: c.meaning, signForm, keywords,
      source: 'curated', sourceRef: m.rows[0].Code,
      frequency: Number.isFinite(Number(m.rows[0]['SignFrequency(M)'])) ? Number(m.rows[0]['SignFrequency(M)']) : null,
    };
  });
}

export const curatedGestures = buildCuratedGestures();
