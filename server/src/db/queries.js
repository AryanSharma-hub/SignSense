// Row -> API shape mappers. camelCase on the wire; step objects use the v1 shape
// {E, HD, L, H:{right,left}, M:{right,left}} so client code never sees raw columns.

export async function getParameters(db) {
  const [e, h, m, hd, l] = await Promise.all([
    db.query('select * from expressions order by id'),
    db.query('select * from hands order by id'),
    db.query('select * from movements order by id'),
    db.query('select * from heads order by id'),
    db.query('select * from locations order by id'),
  ]);
  return {
    expressions: e.rows.map((r) => ({ id: r.id, label: r.label, glyph: r.glyph, family: r.family, needsReview: r.needs_review })),
    hands: h.rows.map((r) => ({ id: r.id, label: r.label, glyph: r.glyph, family: r.family, bothHanded: r.both_handed, shape: r.shape, needsReview: r.needs_review })),
    movements: m.rows.map((r) => ({ id: r.id, label: r.label, dir: r.dir, family: r.family, needsReview: r.needs_review })),
    heads: hd.rows.map((r) => ({ id: r.id, label: r.label, glyph: r.glyph, family: r.family, rot: r.rotation_deg, dragDir: r.drag_dir, motion: r.motion, needsReview: r.needs_review })),
    locations: l.rows.map((r) => ({ id: r.id, label: r.label, bodyRegion: r.body_region, anchorX: r.anchor_x, anchorY: r.anchor_y, family: r.family, needsReview: r.needs_review })),
  };
}

export async function getGestures(db) {
  const [g, s, k] = await Promise.all([
    db.query('select * from gestures order by id'),
    db.query('select * from gesture_steps order by gesture_id, step_order'),
    db.query('select * from gesture_keywords order by gesture_id, weight desc, keyword'),
  ]);
  const steps = new Map(), kws = new Map();
  for (const r of s.rows) {
    if (!steps.has(r.gesture_id)) steps.set(r.gesture_id, []);
    steps.get(r.gesture_id).push({
      E: r.expression_id, HD: r.head_id, L: r.location_id,
      H: { right: r.hand_right_id, left: r.hand_left_id },
      M: { right: r.movement_right_id, left: r.movement_left_id },
      joined: r.joined,
      together: r.together || [],
    });
  }
  for (const r of k.rows) {
    if (!kws.has(r.gesture_id)) kws.set(r.gesture_id, []);
    kws.get(r.gesture_id).push({ keyword: r.keyword, weight: r.weight });
  }
  return g.rows.map((r) => ({
    id: r.id, gloss: r.gloss, meaning: r.meaning, pos: r.pos, english: r.english,
    needsReview: r.needs_review,
    source: r.source ?? null, sourceRef: r.source_ref ?? null,
    frequency: r.frequency == null ? null : Math.round(r.frequency * 1000) / 1000,
    signForm: steps.get(r.id) || [],
    keywords: kws.get(r.id) || [],
  }));
}

/** Compact vocabulary for LLM prompts, read server-side so it can't be tampered with. */
export async function getKeywordVocabulary(db) {
  const gestures = await getGestures(db);
  return gestures.map((g) => ({ gloss: g.gloss, keywords: g.keywords.map((k) => k.keyword) }));
}

/**
 * The full gesture list, cached per database until something changes it. Every write
 * path (seeding, admin edits) must call invalidateGestures(db).
 */
const gestureCache = new WeakMap();
export function getGesturesCached(db) {
  if (!gestureCache.has(db)) {
    const p = getGestures(db);
    gestureCache.set(db, p);
    p.catch(() => gestureCache.delete(db));
  }
  return gestureCache.get(db);
}
export function invalidateGestures(db) { gestureCache.delete(db); }
