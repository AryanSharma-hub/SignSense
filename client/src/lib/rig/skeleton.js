/**
 * The signer's skeleton: proportions, joint limits and the one coordinate convention.
 *
 * Coordinates: the 240x300 signer viewBox, x to the viewer's right, y DOWN. The figure
 * faces the viewer as a mirror image — the signer's right hand is on the viewer's right —
 * which is the convention every location anchor in the sign data was authored in.
 * Handedness becomes a sign in exactly one place, `sideSign`, so no other code flips
 * coordinates per side (a second, ad-hoc flip is what reverses a sign's meaning).
 *
 * Angles are degrees, 0 = the hand's fingers pointing straight up, positive = clockwise
 * on screen (the SVG rotate() convention).
 */
export const BODY = {
  head: { cx: 120, cy: 78, rx: 35, ry: 43 },
  /** Head and face rotate about the top of the neck, not the head's centre. */
  neckPivot: { x: 120, y: 118 },
  shoulder: { right: { x: 164, y: 148 }, left: { x: 76, y: 148 } },
  upperArm: 40,
  forearm: 38,
  /** Distance from the wrist joint to the hand's origin (palm centre), in viewBox units. */
  wristToPalm: 14.3,
  handScale: 1.3,
  /** Limb radii for drawing: shoulder, elbow, wrist. */
  limbRadius: { shoulder: 11, elbow: 8.5, wrist: 6.2 },
};

export const LIMITS = {
  /** Smallest interior elbow angle: a forearm cannot fold flat onto the upper arm. */
  elbowMinDeg: 28,
  /** How far the wrist may bend away from the forearm's line, either way. */
  wristDeg: 72,
  /** How far the shoulder may rise toward an out-of-reach target. */
  shoulderLift: 9,
  /** Closest two independent hands may come before they are eased apart. */
  handGap: 22,
};

export const SIDES = ['right', 'left'];
export const sideSign = (side) => (side === 'right' ? 1 : -1);

/**
 * Elbow "pole": the direction the elbow bends toward — outward and slightly down, the
 * natural carriage of a signer's arms. Mirrored per side through sideSign only.
 */
export const elbowPole = (side) => ({ x: sideSign(side) * 0.9, y: 0.45 });

export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Normalise an angle in degrees to (-180, 180]. */
export const normDeg = (a) => {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};
/** Rotate a local offset by `deg` (SVG convention). */
export const rotate = (x, y, deg) => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return { x: x * c - y * s, y: x * s + y * c };
};
