/**
 * Handshape -> finger joint angles (radians), for a skeleton with three joints per digit.
 *
 * The input is the same shape every handshape row carries (lib/handGeometry.js reads it
 * for the 2D hand): curl[thumb, index, middle, ring, pinky] 0 = extended .. 1 = fully
 * curled, spread 0..1, and an optional thumbAngle (degrees, -55 = relaxed abduction,
 * toward 0 = alongside the fingers, more negative = out to the side).
 *
 * Angles are absolute flexion from a straight digit; the rig subtracts whatever bend the
 * avatar's rest pose already has, so curl 0 really is a straight finger.
 */
const DEG = Math.PI / 180;
const clamp01 = (v) => Math.max(0, Math.min(1, v ?? 0));

/** Full-curl flexion per joint: knuckle (MCP), middle (PIP), tip (DIP). A fist is ~85/100/65 degrees. */
export const FLEX_MAX = [85 * DEG, 100 * DEG, 65 * DEG];
/** Spread (abduction at the knuckle) per finger at spread = 1; + fans away from the middle finger. */
export const SPREAD_MAX = { index: 14 * DEG, middle: 3 * DEG, ring: 8 * DEG, pinky: 18 * DEG };
export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const THUMB_REST_ANGLE = -55;

export function fingerAngles(shape) {
  const curl = shape?.curl || [0, 0, 0, 0, 0];
  const spread = clamp01(shape?.spread);
  const out = {};
  FINGERS.forEach((name, i) => {
    const c = clamp01(curl[i + 1]);
    out[name] = {
      flex: FLEX_MAX.map((m) => m * c),
      // A curled finger can't fan out; the spread fades as it closes.
      spread: SPREAD_MAX[name] * spread * (1 - 0.8 * c),
    };
  });
  const tc = clamp01(curl[0]);
  const ta = shape?.thumbAngle ?? THUMB_REST_ANGLE;
  out.thumb = {
    // Opposition: the thumb swings across the palm toward the little finger as it curls.
    fold: 50 * DEG * tc,
    flex: [0, 35 * DEG * tc, 55 * DEG * tc],
    // thumbAngle closer to 0 brings the thumb in beside the index finger; more negative opens it.
    abduct: Math.max(-30 * DEG, Math.min(45 * DEG, (ta - THUMB_REST_ANGLE) * DEG * 0.6)),
  };
  return out;
}

/**
 * Palm orientation hints a few handshapes carry in their names (there is no orientation
 * field in the data): open palms "up" / "request" are offered palm-up; "together" is two
 * palms pressed to each other.
 */
export function palmHint(label) {
  if (!label) return null;
  if (/palm up|request/i.test(label)) return 'up';
  if (/together/i.test(label)) return 'together';
  return null;
}
