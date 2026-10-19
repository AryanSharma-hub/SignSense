import { expressions, hands as appHands, movements as appMovements, heads, locations as appLocations } from './vocabParams.js';
import { fingerspellHands } from './fingerspellHands.js';
import { curatedGestures } from './curatedGestures.js';
import { authoredGestures } from './authoredGestures.js';
import { buildAslLexData } from './aslLex/index.js';
import { DIRECTIONAL_VERBS } from './wordLists.js';

export { expressions, heads };
export { fingerspellHands, fingerspellId } from './fingerspellHands.js';

/**
 * Every sign comes from one of three sources, recorded per gesture as `source`:
 *   curated  — 16 core conversation signs: phonology built from their ASL-LEX entry,
 *              plus curated same-sign keywords and citation-form face/head markers
 *   asl-lex  — every other ASL-LEX 2.0 sign meaning (handshape, sign type, movement,
 *              locations, handshape change from the published coding)
 *   authored — a short list of very common signs ASL-LEX lacks, coded in ASL-LEX's own
 *              categories (see authoredGestures.js)
 * There is no placeholder/invented source: a word with no sign stays unsigned (and is
 * fingerspelled when it is a name or a number).
 */
const claimed = new Set(curatedGestures.flatMap((g) => g.keywords.filter(([, w]) => w >= 0.9).map(([k]) => k.toLowerCase())));
const aslLex = buildAslLexData({ claimed, claimedGlosses: new Set([...curatedGestures, ...authoredGestures].map((g) => g.gloss)) });

export const hands = [...appHands, ...aslLex.hands, ...fingerspellHands];
export const movements = [...appMovements, ...aslLex.movements];
export const locations = [...appLocations, ...aslLex.locations];

export const gestures = [
  ...curatedGestures,
  ...aslLex.gestures,
  // An authored sign never shadows a real ASL-LEX sign for the same word.
  ...authoredGestures.filter((g) => !aslLex.gestures.some((x) => x.english === g.english)),
];

// Directional verbs absorb "me": "give me" -> GIVE (moving toward the signer).
for (const g of gestures) {
  if (DIRECTIONAL_VERBS.includes(g.english) && (g.pos === 'verb' || g.source === 'curated') && g.keywords[0]?.[1] === 1) {
    g.keywords.push([`${g.english} me`, 0.9]);
  }
}

/** ASL-LEX meanings that were deliberately not imported, with the reason (for the vocabulary report). */
export const aslLexSkipped = aslLex.skipped;
