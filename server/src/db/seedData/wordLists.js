/**
 * Word lists shared by every vocabulary source.
 */

/**
 * Pure function/grammar words — mirrors client/src/lib/speechToGloss/nlp.js's
 * FUNCTION_WORDS/NEGATION_TOKENS (duplicated as plain data here since server and client
 * are separate workspace packages). A keyword match runs BEFORE the matcher's own
 * grammar-word check, so if one of these became a gesture it would be signed in every
 * sentence that uses it — they never become gestures. Negation ("not", "never") is
 * carried by the headshake marker instead (client/src/lib/nonManual.js).
 *
 * "my"/"your"/"his"/"our"/"mine"/"us" are deliberately NOT here: ASL-LEX has real signs
 * for them and a signer does sign MY/YOUR/OUR. Likewise "again", "all" and "many", which
 * carry meaning a signer signs (AGAIN, ALL, MANY). Modals (can/will/must/should) stay here:
 * they do not map one-to-one onto ASL signs.
 */
export const GRAMMAR_WORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'of', 'to', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'about', 'as', 'into',
  'than', 'that', 'this', 'these', 'those', 'there', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'would', 'could', 'should', 'will', 'shall', 'can', 'may', 'might', 'must',
  'it', 'its', 'and', 'or', 'but', 'if', 'so', 'then', 'nor', 'thus',
  'her', 'their', 'yours', 'ours', 'theirs', 'him', 'them',
  'not', 'never', 'cannot',
  'each', 'every', 'both', 'most', 'much', 'such', 'own', 'very', 'just', 'only', 'too', 'also',
  'out', 'up', 'down', 'over', 'under', 'off', 'once', 'while', 'until', 'since', 'though', 'although',
  'either', 'except', 'perhaps', 'quite', 'else', 'rather', 'yet', 'well', 'through', 'side', 'part',
]);

/**
 * English words that ASL signs with the SAME sign as an ASL-LEX lemma — added as extra
 * keywords on that lemma's gesture. Only true same-sign equivalences belong here (e.g.
 * ASL uses one sign for PRETTY and BEAUTIFUL, one for HARD and DIFFICULT); words that
 * merely mean something similar but are signed differently must NOT be listed — those
 * stay unsigned until a real source provides their sign.
 *
 * word -> ASL-LEX lemma (base LemmaID, lowercase)
 */
export const SAME_SIGN_SYNONYMS = {
  goodbye: 'bye',
  okay: 'ok',
  she: 'he',                // ASL third-person pronoun is one point, whatever the gender
  afraid: 'scared',
  frightened: 'scared',
  worried: 'worry',
  phone: 'telephone',
  cellphone: 'telephone',
  coat: 'jacket',
  beautiful: 'pretty',
  difficult: 'hard',
  dangerous: 'danger',
  quick: 'fast',
  quickly: 'fast',
  search: 'look_for',
  little: 'small',
  surprised: 'surprise',
  embarrassed: 'embarrass',
  look: 'look_at',
  food: 'eat',
  job: 'work',
  photo: 'picture',
  photograph: 'picture',
  married: 'marry',
  exam: 'test',
  ill: 'sick',
  sea: 'ocean',
  restroom: 'bathroom',
  toilet: 'bathroom',
  television: 'tv',
  healthy: 'health',
  closed: 'close',
  shut: 'close',
  wonderful: 'great',
  town: 'city',
  sugar: 'sweet',
};

/**
 * Display glosses for lemmas whose ASL meaning is broader than their English lemma name.
 * Keyed by lemma; only the gloss changes, never the phonology.
 */
export const GLOSS_OVERRIDES = {
  he: 'HE/SHE',
};

/** ASL-LEX "Minor" class words that are pronouns (the rest of Minor is prepositions/conjunctions). */
export const PRONOUNS = new Set(['i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yourself', 'he', 'she', 'we', 'us',
  'our', 'they', 'his', 'hers', 'itself', 'ourselves', 'themselves', 'yourselves', 'who', 'what', 'someone', 'something',
  'somebody', 'nothing', 'nobody', 'everyone', 'everything']);

/**
 * ASL directional (agreement) verbs: the sign itself moves toward the signer to mean
 * "… me", so "give me" is GIVE moving inward — not GIVE followed by a separate ME sign.
 * Each gets the phrase "<verb> me" as a keyword, so the object is absorbed into the verb.
 */
export const DIRECTIONAL_VERBS = ['give', 'tell', 'show', 'ask', 'send', 'pay', 'teach', 'help', 'bring', 'inform', 'email', 'call', 'text'];
