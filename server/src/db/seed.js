import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDb } from './adapter.js';
import * as data from './seedData.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function migrate(db) {
  await db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
}

/**
 * Seed only when the vocabulary tables are empty, so an admin's edits made directly
 * in the database are never overwritten on a routine restart. Pass {force:true}
 * (npm run seed:reset) to upsert the draft seed over existing rows.
 */
export async function seedIfEmpty(db, { force = false } = {}) {
  const { rows } = await db.query('select count(*)::int as n from gestures');
  if (rows[0].n > 0 && !force) return { seeded: false };

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

  // Which hand ids are inherently two-handed (used to store the per-step `joined` flag).
  const bothHanded = new Set(data.hands.filter((h) => h.bothHanded).map((h) => h.id));

  for (const g of data.gestures) {
    const { rows: gr } = await db.query(
      `insert into gestures (gloss,meaning,pos,english) values ($1,$2,$3,$4)
       on conflict (gloss) do update set meaning=$2, pos=$3, english=$4
       returning id`,
      [g.gloss, g.meaning, g.pos, g.english]);
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
      await db.query(
        'insert into gesture_keywords (gesture_id,keyword,weight) values ($1,$2,$3)',
        [gid, keyword.toLowerCase(), weight]);
    }
  }
  return { seeded: true };
}

// `node src/db/seed.js [--force]`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes('--force');
  const db = await createDb();
  await migrate(db);
  const res = await seedIfEmpty(db, { force });
  console.log(res.seeded ? `Seeded draft vocabulary (${db.kind}).` : 'Database already has gestures — skipped (use --force to re-seed).');
  await db.close();
}
