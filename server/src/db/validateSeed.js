/**
 * Checks over the seed data, independent of any database — catches typos, dangling
 * references and accuracy regressions before they ever reach `npm run seed`.
 * Run via `npm run seed:validate` (server workspace) or `node src/db/validateSeed.js`.
 *
 * Beyond structure, it CROSS-VERIFIES every ASL-LEX-sourced sign (curated and asl-lex):
 * the sign's phonology is re-derived from its ASL-LEX row and must match what is stored,
 * so a hand edit that drifts from the source is caught here.
 */
import * as data from './seedData.js';
import { loadAslLexRows, stepsFromRow } from './seedData/aslLex/index.js';
import { GRAMMAR_WORDS } from './seedData/wordLists.js';

export const SOURCES = new Set(['curated', 'asl-lex', 'authored']);

function fail(problems, msg) { problems.push(msg); }

/** Only the manual phonology of a step: what ASL-LEX actually codes. */
const manual = (s) => ({ L: s.L ?? null, H: { right: s.H?.right ?? null, left: s.H?.left ?? null }, M: { right: s.M?.right ?? null, left: s.M?.left ?? null } });

/** Re-derive each ASL-LEX-sourced sign from its row; returns [{gloss, ref, problem}] for any mismatch. */
export function crossVerify(gestures = data.gestures) {
  const rows = new Map(loadAslLexRows().map((r) => [r.Code, r]));
  const out = [];
  let checked = 0;
  for (const g of gestures) {
    if (g.source !== 'asl-lex' && g.source !== 'curated') continue;
    checked++;
    const row = rows.get(g.sourceRef);
    if (!row) { out.push({ gloss: g.gloss, ref: g.sourceRef, problem: 'source entry not found in ASL-LEX' }); continue; }
    const expect = stepsFromRow(row);
    if (!expect) { out.push({ gloss: g.gloss, ref: g.sourceRef, problem: 'source entry has no codable handshape' }); continue; }
    if (JSON.stringify(expect.map(manual)) !== JSON.stringify(g.signForm.map(manual))) {
      out.push({ gloss: g.gloss, ref: g.sourceRef, problem: 'stored phonology differs from the ASL-LEX coding' });
    }
  }
  return { checked, mismatches: out };
}

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
  const keywordSetSeen = new Map(); // keyword+weight set -> gloss, to flag exact duplicates
  const strongClaims = new Map();   // keyword -> gloss, for keywords claimed at full strength

  for (const g of data_.gestures) {
    if (glossSeen.has(g.gloss)) fail(problems, `duplicate gloss: ${g.gloss}`);
    glossSeen.add(g.gloss);

    if (!SOURCES.has(g.source)) fail(problems, `${g.gloss}: unknown or missing source "${g.source}" (placeholder data is not allowed)`);
    if ((g.source === 'asl-lex' || g.source === 'curated') && !g.sourceRef) fail(problems, `${g.gloss}: ${g.source} sign without an ASL-LEX reference`);

    if (!g.signForm || g.signForm.length === 0) fail(problems, `${g.gloss}: empty signForm`);
    if (g.signForm?.[0] && !g.signForm[0].H?.right && !g.signForm[0].H?.left) fail(problems, `${g.gloss}: first step has no handshape`);
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
    for (const [k, w] of g.keywords || []) {
      if (GRAMMAR_WORDS.has(k.toLowerCase())) fail(problems, `${g.gloss}: grammar word "${k}" used as a keyword — it would be signed in every sentence`);
      if (!(w > 0 && w <= 1)) fail(problems, `${g.gloss}: keyword "${k}" has weight ${w} outside (0,1]`);
      if (w >= 0.95) {
        const prev = strongClaims.get(k.toLowerCase());
        if (prev) fail(problems, `keyword "${k}" fully claimed by both ${prev} and ${g.gloss} — ambiguous`);
        else strongClaims.set(k.toLowerCase(), g.gloss);
      }
    }
    const keySet = (g.keywords || []).map(([k, w]) => `${k}:${w}`).sort().join('|');
    if (keywordSetSeen.has(keySet)) fail(problems, `${g.gloss}: identical keywords and weights to ${keywordSetSeen.get(keySet)}`);
    else keywordSetSeen.set(keySet, g.gloss);
  }

  for (const m of crossVerify(data_.gestures).mismatches) fail(problems, `${m.gloss} (${m.ref}): ${m.problem}`);
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
  const { checked } = crossVerify();
  console.log(`OK — ${data.gestures.length} gestures (${checked} cross-verified against ASL-LEX), ${data.hands.length} hands, ${data.movements.length} movements, ${data.locations.length} locations validated clean.`);
}
