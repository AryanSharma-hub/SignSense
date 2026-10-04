import { expressions, hands as expressiveHands, movements as placeholderMovements, heads, locations as placeholderLocations } from './vocabParams.js';
import { fingerspellHands } from './fingerspellHands.js';
import { curatedGestures } from './curatedGestures.js';
import { buildAslLexData } from './aslLex/index.js';
import { buildBulkGestures } from './generate.js';

export { expressions, heads };
export { fingerspellHands, fingerspellId } from './fingerspellHands.js';

const aslLex = buildAslLexData(curatedGestures);

// Fingerspelling hands and ASL-LEX's 58 real handshapes join the expressive (placeholder)
// set in the one `hands` table the app reads, distinguished by `family` so pickers and
// search can tell them apart from ordinary/placeholder handshapes.
export const hands = [...expressiveHands, ...aslLex.hands, ...fingerspellHands];
export const movements = [...placeholderMovements, ...aslLex.movements];
export const locations = [...placeholderLocations, ...aslLex.locations];

// The placeholder/hash-based generator only ever draws from the expressive+placeholder
// vocab (never ASL-LEX's or fingerspelling's), and skips any gloss/keyword already claimed
// by the curated 16 or by ASL-LEX — so it only fills in words neither of those cover.
const bulkGestures = buildBulkGestures(
  { expressions, hands: expressiveHands, movements: placeholderMovements, heads, locations: placeholderLocations },
  [...curatedGestures, ...aslLex.gestures],
);

export const gestures = [...curatedGestures, ...aslLex.gestures, ...bulkGestures];
