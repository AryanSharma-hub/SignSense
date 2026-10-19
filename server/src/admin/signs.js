/**
 * Validation and storage for signs written from the admin dashboard. The same step shape
 * as the seed ({E, HD, L, H:{right,left}, M:{right,left}, together}); every id must exist in
 * the parameter tables, so an admin edit can never store a sign the avatar cannot render.
 */
import { getParameters } from '../db/queries.js';

export const POS = ['noun', 'verb', 'adj', 'adv', 'pronoun', 'interj'];
const PARAM_KEYS = ['E', 'H', 'M', 'HD', 'L'];

const str = (v, max) => (v == null ? '' : String(v).trim().slice(0, max + 1));

export async function validateSign(db, body) {
  const b = body || {};
  const gloss = str(b.gloss, 60).toUpperCase().replace(/\s+/g, ' ');
  if (!gloss || gloss.length > 60) return { error: 'Gloss is required (up to 60 characters).' };
  const meaning = str(b.meaning, 400);
  if (!meaning || meaning.length > 400) return { error: 'Meaning is required (up to 400 characters).' };
  const english = str(b.english, 60).toLowerCase() || gloss.toLowerCase();
  const pos = b.pos ? String(b.pos) : null;
  if (pos && !POS.includes(pos)) return { error: `Part of speech must be one of: ${POS.join(', ')}.` };

  const keywords = [];
  const seen = new Set();
  for (const k of Array.isArray(b.keywords) ? b.keywords : []) {
    const keyword = str(k?.keyword ?? k, 60).toLowerCase();
    const weight = k?.weight == null ? 1 : Number(k.weight);
    if (!keyword) continue;
    if (keyword.length > 60) return { error: `Keyword "${keyword.slice(0, 20)}…" is too long.` };
    if (!(weight > 0 && weight <= 1)) return { error: `Keyword "${keyword}" needs a weight between 0 and 1.` };
    if (!seen.has(keyword)) { seen.add(keyword); keywords.push({ keyword, weight }); }
  }
  if (!seen.has(english)) keywords.unshift({ keyword: english, weight: 1 });
  if (keywords.length > 40) return { error: 'Up to 40 keywords.' };

  const params = await getParameters(db);
  const ids = {
    E: new Set(params.expressions.map((x) => x.id)), H: new Set(params.hands.map((x) => x.id)),
    M: new Set(params.movements.map((x) => x.id)), HD: new Set(params.heads.map((x) => x.id)),
    L: new Set(params.locations.map((x) => x.id)),
  };
  const steps = Array.isArray(b.signForm) ? b.signForm : [];
  if (steps.length < 1 || steps.length > 12) return { error: 'A sign needs between 1 and 12 steps.' };
  const signForm = [];
  for (const [i, s] of steps.entries()) {
    const step = {
      E: s?.E || null, HD: s?.HD || null, L: s?.L || null,
      H: { right: s?.H?.right || null, left: s?.H?.left || null },
      M: { right: s?.M?.right || null, left: s?.M?.left || null },
      together: [],
    };
    const check = [['E', step.E], ['HD', step.HD], ['L', step.L], ['H', step.H.right], ['H', step.H.left], ['M', step.M.right], ['M', step.M.left]];
    for (const [k, id] of check) if (id && !ids[k].has(id)) return { error: `Step ${i + 1}: unknown ${k} value "${id}".` };
    for (const pair of Array.isArray(s?.together) ? s.together : []) {
      if (Array.isArray(pair) && pair.length === 2 && pair.every((k) => PARAM_KEYS.includes(k)) && pair[0] !== pair[1]) step.together.push([...pair].sort());
    }
    signForm.push(step);
  }
  if (!signForm[0].H.right && !signForm[0].H.left) return { error: 'The first step needs a handshape.' };
  return { sign: { gloss, meaning, english, pos, keywords, signForm } };
}

export async function writeSign(db, sign, { id = null, source = 'admin' } = {}) {
  const bothHanded = new Set((await getParameters(db)).hands.filter((h) => h.bothHanded).map((h) => h.id));
  let gid = id;
  if (gid) {
    await db.query('update gestures set gloss=$1, meaning=$2, pos=$3, english=$4, updated_at=now() where id=$5',
      [sign.gloss, sign.meaning, sign.pos, sign.english, gid]);
  } else {
    const { rows } = await db.query(
      'insert into gestures (gloss, meaning, pos, english, source, updated_at) values ($1,$2,$3,$4,$5,now()) returning id',
      [sign.gloss, sign.meaning, sign.pos, sign.english, source]);
    gid = rows[0].id;
  }
  await db.query('delete from gesture_steps where gesture_id=$1', [gid]);
  await db.query('delete from gesture_keywords where gesture_id=$1', [gid]);
  for (const [i, s] of sign.signForm.entries()) {
    const r = s.H.right, l = s.H.left;
    const joined = !!((r && bothHanded.has(r)) || (l && bothHanded.has(l)) || (r && l && r === l));
    await db.query(
      `insert into gesture_steps (gesture_id,step_order,expression_id,head_id,hand_right_id,hand_left_id,
         movement_right_id,movement_left_id,location_id,joined,together) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [gid, i, s.E, s.HD, r, l, s.M.right, s.M.left, s.L, joined, JSON.stringify(s.together)]);
  }
  for (const k of sign.keywords) {
    await db.query('insert into gesture_keywords (gesture_id, keyword, weight) values ($1,$2,$3)', [gid, k.keyword, k.weight]);
  }
  return gid;
}
