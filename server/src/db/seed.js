import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDb } from './adapter.js';
import { getGestures, invalidateGestures } from './queries.js';
import * as data from './seedData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

export async function migrate(db) {
  await db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
}

/**
 * Canonical content of a gesture — the same shape whether it comes from the seed data or
 * back out of the database — so its fingerprint tells "as seeded" from "edited since".
 */
function canonical(g) {
  const kw = (g.keywords || []).map((k) => (Array.isArray(k) ? k : [k.keyword, k.weight]))
    .map(([k, w]) => [String(k).toLowerCase(), Math.round(Number(w) * 1000) / 1000])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify({
    meaning: g.meaning, pos: g.pos ?? null, english: g.english ?? null,
    steps: (g.signForm || []).map((s) => [s.E ?? null, s.HD ?? null, s.L ?? null, s.H?.right ?? null, s.H?.left ?? null,
      s.M?.right ?? null, s.M?.left ?? null, s.together ?? []]),
    keywords: kw,
  });
}
export const gestureChecksum = (g) => sha1(canonical(g));

/** Fingerprint of the whole seed: when the shipped data changes, existing databases upgrade. */
export const SEED_VERSION = sha1(JSON.stringify([data.expressions, data.hands, data.movements, data.heads, data.locations,
  data.gestures.map((g) => [g.gloss, gestureChecksum(g), g.source, g.sourceRef, g.frequency])])).slice(0, 16);

async function upsertParameters(db) {
  for (const e of data.expressions) {
    await db.query(
      `insert into expressions (id,label,glyph,family) values ($1,$2,$3,$4)
       on conflict (id) do update set label=$2, glyph=$3, family=$4`,
      [e.id, e.label, e.glyph, e.family]);
  }
  for (const h of data.hands) {
    await db.query(
      `insert into hands (id,label,glyph,family,both_handed,shape) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set label=$2, glyph=$3, family=$4, both_handed=$5, shape=$6`,
      [h.id, h.label, h.glyph, h.family, !!h.bothHanded, JSON.stringify(h.shape)]);
  }
  for (const m of data.movements) {
    await db.query(
      `insert into movements (id,label,dir,family) values ($1,$2,$3,$4)
       on conflict (id) do update set label=$2, dir=$3, family=$4`,
      [m.id, m.label, m.dir, m.family]);
  }
  for (const h of data.heads) {
    await db.query(
      `insert into heads (id,label,glyph,family,rotation_deg,drag_dir,motion) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set label=$2, glyph=$3, family=$4, rotation_deg=$5, drag_dir=$6, motion=$7`,
      [h.id, h.label, h.glyph, h.family, h.rotationDeg, h.dragDir, h.motion]);
  }
  for (const l of data.locations) {
    await db.query(
      `insert into locations (id,label,body_region,anchor_x,anchor_y,family) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set label=$2, body_region=$3, anchor_x=$4, anchor_y=$5, family=$6`,
      [l.id, l.label, l.bodyRegion, l.anchorX, l.anchorY, l.family]);
  }
}

/** Parameter rows the seed no longer ships are removed — but only when no step still uses them. */
async function pruneParameters(db) {
  const prune = async (table, ids, refSql) => {
    await db.query(`delete from ${table} where not (id = any($1)) and id not in (${refSql})`, [ids]);
  };
  await prune('hands', data.hands.map((h) => h.id),
    'select hand_right_id from gesture_steps where hand_right_id is not null union select hand_left_id from gesture_steps where hand_left_id is not null');
  await prune('movements', data.movements.map((m) => m.id),
    'select movement_right_id from gesture_steps where movement_right_id is not null union select movement_left_id from gesture_steps where movement_left_id is not null');
  await prune('locations', data.locations.map((l) => l.id), 'select location_id from gesture_steps where location_id is not null');
}

const bothHanded = new Set(data.hands.filter((h) => h.bothHanded).map((h) => h.id));

async function writeGesture(db, g) {
  const { rows: gr } = await db.query(
    `insert into gestures (gloss,meaning,pos,english,source,source_ref,frequency,seed_checksum) values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (gloss) do update set meaning=$2, pos=$3, english=$4, source=$5, source_ref=$6, frequency=$7, seed_checksum=$8
     returning id`,
    [g.gloss, g.meaning, g.pos ?? null, g.english ?? null, g.source, g.sourceRef ?? null, g.frequency ?? null, gestureChecksum(g)]);
  const gid = gr[0].id;
  await db.query('delete from gesture_steps where gesture_id=$1', [gid]);
  await db.query('delete from gesture_keywords where gesture_id=$1', [gid]);
  for (let i = 0; i < g.signForm.length; i++) {
    const s = g.signForm[i];
    const r = s.H?.right ?? null, l = s.H?.left ?? null;
    const joined = !!((r && bothHanded.has(r)) || (l && bothHanded.has(l)) || (r && l && r === l));
    await db.query(
      `insert into gesture_steps
         (gesture_id,step_order,expression_id,head_id,hand_right_id,hand_left_id,
          movement_right_id,movement_left_id,location_id,joined,together)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [gid, i, s.E ?? null, s.HD ?? null, r, l, s.M?.right ?? null, s.M?.left ?? null, s.L ?? null, joined,
        JSON.stringify(s.together ?? [])]);
  }
  for (const [keyword, weight] of g.keywords) {
    await db.query('insert into gesture_keywords (gesture_id,keyword,weight) values ($1,$2,$3)', [gid, keyword.toLowerCase(), weight]);
  }
}

/**
 * Bring the vocabulary in line with the shipped seed:
 *   - empty database           -> seed everything
 *   - seed unchanged           -> nothing (a routine restart never touches the data)
 *   - seed changed (upgrade)   -> update every row still exactly as last seeded, add new
 *                                 signs, remove signs the seed dropped; rows an admin edited
 *                                 since seeding (fingerprint mismatch) are KEPT as they are
 *   - {force:true}             -> overwrite everything with the seed (npm run seed:reset)
 * Rows written before fingerprints existed (pre-v5) count as unedited seed rows. Signs an admin
 * created (source 'admin') are never removed, and seed signs an admin deleted are not re-added.
 *
 * @returns {{seeded:boolean, upgraded?:boolean, kept?:string[], removed?:number}}
 */
export async function seedIfEmpty(db, { force = false } = {}) {
  const { rows } = await db.query('select count(*)::int as n from gestures');
  const empty = rows[0].n === 0;
  const stored = (await db.query("select value from seed_meta where key='version'")).rows[0]?.value;
  if (!empty && !force && stored === SEED_VERSION) return { seeded: false };

  await upsertParameters(db);

  const current = empty ? new Map() : new Map((await getGestures(db)).map((g) => [g.gloss, g]));
  const fingerprints = empty ? new Map()
    : new Map((await db.query('select gloss, seed_checksum from gestures')).rows.map((r) => [r.gloss, r.seed_checksum]));
  const edited = (gloss) => {
    if (force) return false;
    const fp = fingerprints.get(gloss);
    return fp != null && gestureChecksum(current.get(gloss)) !== fp;
  };

  // Seed signs an admin deleted stay deleted (unless forced).
  const tombstones = force ? new Set()
    : new Set((await db.query('select gloss from deleted_signs')).rows.map((r) => r.gloss));
  const kept = [];
  for (const g of data.gestures) {
    if (tombstones.has(g.gloss)) continue;
    if (current.has(g.gloss) && edited(g.gloss)) { kept.push(g.gloss); continue; }
    await writeGesture(db, g);
  }
  if (force) await db.query('delete from deleted_signs');
  const seedGlosses = new Set(data.gestures.map((g) => g.gloss));
  let removed = 0;
  for (const [gloss, row] of current) {
    if (seedGlosses.has(gloss)) continue;
    // Signs created in the admin dashboard are not seed rows: never removed by an upgrade.
    if (row.source === 'admin' && !force) continue;
    if (edited(gloss)) { kept.push(gloss); continue; }
    await db.query('delete from gestures where gloss=$1', [gloss]);
    removed++;
  }
  await pruneParameters(db);
  invalidateGestures(db);
  await db.query(
    "insert into seed_meta (key,value) values ('version',$1) on conflict (key) do update set value=$1", [SEED_VERSION]);
  return { seeded: true, upgraded: !empty, kept, removed };
}

// `node src/db/seed.js [--force]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force');
  const db = await createDb();
  await migrate(db);
  const res = await seedIfEmpty(db, { force });
  if (!res.seeded) console.log('Vocabulary is already up to date — skipped (use --force to re-seed).');
  else {
    console.log(`${res.upgraded ? 'Upgraded' : 'Seeded'} vocabulary: ${data.gestures.length} signs (${db.kind}).`);
    if (res.removed) console.log(`Removed ${res.removed} signs no longer in the seed.`);
    if (res.kept?.length) console.log(`Kept ${res.kept.length} admin-edited signs unchanged: ${res.kept.slice(0, 20).join(', ')}${res.kept.length > 20 ? ', …' : ''}`);
  }
  await db.close();
}
