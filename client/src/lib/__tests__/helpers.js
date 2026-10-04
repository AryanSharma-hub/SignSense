// Builds the same shapes the API returns, straight from the real seed data.
import * as seed from '../../../../server/src/db/seedData.js';
import { buildVocab } from '../vocabulary.js';
import { buildKeywordIndex } from '../speechToGloss/matcher.js';
import { flattenStepsFlat } from '../steps.js';

const bothHanded = new Set(seed.hands.filter((h) => h.bothHanded).map((h) => h.id));

export const params = {
  expressions: seed.expressions,
  hands: seed.hands.map((h) => ({ ...h, bothHanded: !!h.bothHanded })),
  movements: seed.movements,
  heads: seed.heads.map((h) => ({ ...h, rot: h.rotationDeg })),
  locations: seed.locations,
};
export const vocab = buildVocab(params);

export const gestures = seed.gestures.map((g, i) => ({
  id: i + 1,
  gloss: g.gloss, meaning: g.meaning, pos: g.pos, english: g.english, needsReview: true,
  signForm: g.signForm.map((s) => ({
    E: s.E ?? null, HD: s.HD ?? null, L: s.L ?? null,
    H: { right: s.H?.right ?? null, left: s.H?.left ?? null },
    M: { right: s.M?.right ?? null, left: s.M?.left ?? null },
    together: s.together ?? [],
  })),
  keywords: g.keywords.map(([keyword, weight]) => ({ keyword, weight })),
}));
gestures.forEach((g) => { g.flat = flattenStepsFlat(g.signForm); });

export const index = buildKeywordIndex(gestures);
export { bothHanded };
