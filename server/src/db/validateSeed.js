/**
 * Structural checks over the seed data, independent of any database — catches typos
 * and dangling references before they ever reach `npm run seed`. Run via
 * `npm run seed:validate` (server workspace) or `node src/db/validateSeed.js`.
 */
import * as data from './seedData.js';

function fail(problems, msg) { problems.push(msg); }

export function validateSeed(data_ = data) {
  const problems = [];
  const ids = {
    E: new Set(data_.expressions.map((r) => r.id)),
    H: new Set(data_.hands.map((r) => r.id)),
    M: new Set(data_.movements.map((r) => r.id)),
    HD: new Set(data_.heads.map((r) => r.id)),
    L: new Set(data_.locations.map((r) => r.id)),
  };

  const glossSeen = new Set();
  const keywordSetSeen = new Map(); // normalized keyword set -> gloss, to flag exact duplicates

  for (const g of data_.gestures) {
    if (glossSeen.has(g.gloss)) fail(problems, `duplicate gloss: ${g.gloss}`);
    glossSeen.add(g.gloss);

    if (!g.signForm || g.signForm.length === 0) fail(problems, `${g.gloss}: empty signForm`);
    for (const [i, s] of (g.signForm || []).entries()) {
      const at = `${g.gloss} step ${i}`;
      if (s.E && !ids.E.has(s.E)) fail(problems, `${at}: unknown expression id ${s.E}`);
      if (s.HD && !ids.HD.has(s.HD)) fail(problems, `${at}: unknown head id ${s.HD}`);
      if (s.L && !ids.L.has(s.L)) fail(problems, `${at}: unknown location id ${s.L}`);
      if (s.H?.right && !ids.H.has(s.H.right)) fail(problems, `${at}: unknown right hand id ${s.H.right}`);
      if (s.H?.left && !ids.H.has(s.H.left)) fail(problems, `${at}: unknown left hand id ${s.H.left}`);
      if (s.M?.right && !ids.M.has(s.M.right)) fail(problems, `${at}: unknown right movement id ${s.M.right}`);
      if (s.M?.left && !ids.M.has(s.M.left)) fail(problems, `${at}: unknown left movement id ${s.M.left}`);
      for (const [a, b] of s.together || []) {
        const filled = (k) => (k === 'H' ? !!(s.H?.right || s.H?.left) : k === 'M' ? !!(s.M?.right || s.M?.left) : !!s[k]);
        if (!filled(a) || !filled(b)) fail(problems, `${at}: together pair [${a},${b}] references an empty slot`);
      }
    }

    if (!g.keywords || g.keywords.length === 0) fail(problems, `${g.gloss}: no keywords`);
    const keySet = (g.keywords || []).map(([k]) => k).sort().join('|');
    if (keywordSetSeen.has(keySet)) fail(problems, `${g.gloss}: identical keyword set to ${keywordSetSeen.get(keySet)}`);
    else keywordSetSeen.set(keySet, g.gloss);
  }

  return problems;
}

const isMain = process.argv[1] && process.argv[1].endsWith('validateSeed.js');
if (isMain) {
  const problems = validateSeed();
  if (problems.length) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
  console.log(`OK — ${data.gestures.length} gestures, ${data.hands.length} hands, ${data.movements.length} movements, ${data.locations.length} locations validated clean.`);
}
