/**
 * The starter course: units built from the core everyday vocabulary (seedData/
 * coreVocabulary.js), in teaching order, each split into lessons of up to 8 signs. Only
 * words that resolve to a real sign in the database are used — a lesson never teaches a
 * word the library cannot show. Seeded once, when there are no lessons; after that the
 * course belongs to the administrators (the dashboard edits it).
 */
import { CORE_VOCABULARY } from './seedData/coreVocabulary.js';
import { getGesturesCached } from './queries.js';

export const UNITS = [
  ['social', 'First conversations', 'Greetings, courtesy and the questions every conversation needs.'],
  ['people', 'People & family', 'Pronouns, family members and the people around you.'],
  ['feelings', 'Feelings', 'Saying how you feel.'],
  ['food', 'Food & drink', 'Meals, food and drink.'],
  ['home', 'Home & daily life', 'Things and routines at home.'],
  ['time', 'Time & days', 'Days, times and when things happen.'],
  ['numbers', 'Numbers & amounts', 'Counting and quantities.'],
  ['colors', 'Colours', 'The basic colours.'],
  ['weather', 'Weather & seasons', 'Talking about the weather.'],
  ['describing', 'Describing things', 'Common descriptions and opinions.'],
  ['verbs', 'Everyday actions', 'The verbs used most in daily life.'],
  ['places', 'Places', 'Where you go.'],
  ['travel', 'Getting around', 'Travel and directions.'],
  ['health', 'Health & emergencies', 'Being unwell, getting help and staying safe.'],
];
const LESSON_SIZE = 8;

/** word -> the gesture that signs it (a full-strength keyword or the gloss), or null. */
export function resolveWord(word, gestures) {
  let best = null;
  for (const g of gestures) {
    if (g.gloss.toLowerCase() === word) return g;
    const k = (g.keywords || []).find((x) => (x.keyword ?? x[0]) === word);
    const w = k ? (k.weight ?? k[1]) : 0;
    if (w >= 0.9 && (!best || w > best.w)) best = { g, w };
  }
  return best?.g ?? null;
}

export function buildLessonPlan(gestures) {
  const used = new Set();
  const lessons = [];
  let position = 0;
  for (const [unit, unitTitle, unitDescription] of UNITS) {
    const signs = [];
    for (const word of CORE_VOCABULARY[unit] || []) {
      const g = resolveWord(word, gestures);
      if (g && !used.has(g.id ?? g.gloss)) { used.add(g.id ?? g.gloss); signs.push(g); }
    }
    const chunks = [];
    for (let i = 0; i < signs.length; i += LESSON_SIZE) chunks.push(signs.slice(i, i + LESSON_SIZE));
    // Fold a tiny last chunk into the previous lesson rather than teach 1-2 signs alone.
    if (chunks.length > 1 && chunks.at(-1).length < 4) chunks.at(-2).push(...chunks.pop());
    chunks.forEach((chunk, i) => {
      lessons.push({
        slug: `${unit}-${i + 1}`, unit: unitTitle,
        title: chunks.length > 1 ? `${unitTitle} ${i + 1}` : unitTitle,
        description: `${unitDescription} ${chunk.map((g) => g.gloss).join(', ')}.`,
        position: position++, signs: chunk,
      });
    });
  }
  return lessons;
}

/** Create the starter course if there are no lessons yet. */
export async function seedLessons(db) {
  const { rows } = await db.query('select count(*)::int n from lessons');
  if (rows[0].n > 0) return { seeded: false };
  const plan = buildLessonPlan(await getGesturesCached(db));
  for (const l of plan) {
    const { rows: ins } = await db.query(
      'insert into lessons (slug, unit, title, description, position) values ($1,$2,$3,$4,$5) returning id',
      [l.slug, l.unit, l.title, l.description, l.position]);
    for (const [i, g] of l.signs.entries()) {
      await db.query('insert into lesson_signs (lesson_id, gesture_id, position) values ($1,$2,$3)', [ins[0].id, g.id, i]);
    }
  }
  return { seeded: true, lessons: plan.length };
}
