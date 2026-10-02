import { byId } from './vocabulary.js';

/** Direct-manipulation helpers: turn a drag vector into a movement / head choice. */
const COMPASS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']; // clockwise from east (screen y points down)

export function compassFromVector(x, y) {
  const idx = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  return COMPASS[(idx + 8) % 8];
}
const compassDistance = (a, b) => {
  const d = Math.abs(COMPASS.indexOf(a) - COMPASS.indexOf(b));
  return Math.min(d, 8 - d);
};

/** Drag a hand: the direction snaps to the nearest compass movement; a tiny drag = CENTER (tap). */
export function movementForDrag(vocab, rel, side) {
  const len = Math.hypot(rel.x, rel.y);
  if (len < 12) return vocab.movements.find((m) => m.dir === 'CENTER') || null;
  const x = side === 'left' ? -rel.x : rel.x; // mirror so "toward the body" means the same for both hands
  const dir = compassFromVector(x, rel.y);
  return vocab.movements.find((m) => m.dir === dir) || null;
}

/** Drag the head: snap to the head movement whose drag direction is closest. */
export function headForDrag(vocab, rel) {
  const len = Math.hypot(rel.x, rel.y);
  if (len < 6) return byId(vocab, 'HD', 'HD01') || null;
  const dir = compassFromVector(rel.x, rel.y);
  let best = null;
  for (const h of vocab.heads) {
    if (!h.dragDir) continue;
    const d = compassDistance(dir, h.dragDir);
    if (!best || d < best.d) best = { h, d };
  }
  return best?.h || null;
}
