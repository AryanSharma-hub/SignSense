import { byId } from '../vocabulary.js';
import { resolveHands } from '../resolveHands.js';
import { SIDES } from '../rig/skeleton.js';
import { bodyAnchor, K_TORSO, NEUTRAL_Z, REST_3D, modelX, modelY, surfaceZ } from './bodySpace.js';
import { palmHint } from './handPose.js';

/**
 * ASL realization: one animated frame (useAnimatedPose) + its targets (computeTargets) ->
 * what each hand of the 3D signer does, following how ASL citation forms are made:
 *
 *   WHERE   a body location is a measured point on the avatar (its own side for cheek,
 *           shoulder, temple...), never a stretched 2D position. Signs on the other hand
 *           or forearm go to that hand / arm, which is set up as the base (palm up for the
 *           palm, forearm across the body for arm locations). Neutral signs are made in the
 *           signing space in front of the chest. "...Away" locations are near, not touching.
 *   WHAT    the part of the hand that makes contact follows from the handshape: the index
 *   TOUCHES tip for pointing shapes (I, THINK), the fingertips for O / flat-O / claw shapes
 *           (EAT, MORE), the thumb tip for open 5-hands (MOTHER, FATHER, FINE), the fingertips
 *           of a flat hand at the face (THANK YOU, GOOD) and its palm on the body (PLEASE),
 *           the knuckles of a fist on the body (LOVE), and the pinky side of a fist on the
 *           other hand (HELP).
 *   HOW     the palm orientation that goes with that contact (toward the face for THANK
 *           YOU, sideways for MOTHER, onto the chest for PLEASE, onto the base palm...).
 *   MOVE    the sign's movement on top: taps go to and from the contact surface; paths
 *           move through the signing space.
 *
 * The signer is right-hand dominant: data `right` = dominant hand = the avatar's RightHand.
 */

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const v = (x, y, z) => ({ x, y, z });
const add = (a, b, k = 1) => v(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const scale = (a, k) => v(a.x * k, a.y * k, a.z * k);
const neg = (a) => v(-a.x, -a.y, -a.z);

/** Neutral signing space sits at chest height (the 2D anchors are drawn a little lower). */
const NEUTRAL_LIFT = 0.06;
/** Half the distance between two hands signing a symmetrical sign in space. */
const PAIR_HALF_WIDTH = 0.12;

/** How "in use" a hand is, from its animated alpha — the same ramp the 2D rig uses. */
export const inUse = (alpha) => clamp(((alpha ?? 1) - 0.4) / 0.6, 0, 1);

/** Toward the body's midline for this hand, in model space (the signer's right is model -x). */
export const inwardOf = (side) => (side === 'right' ? 1 : -1);

/**
 * The family of a handshape, from its finger curls: 'fist' (A, S, T...), 'point' (1, V, H,
 * D, I, K...), 'bunch' (O, flat O, C, E, claws: fingertips together or curved), 'five'
 * (open spread hand with the thumb out) or 'flat' (B, 4, open B...).
 */
export function handStyle(shape) {
  const c = shape?.curl || [0, 0, 0, 0, 0];
  const f = c.slice(1);
  if (f.every((x) => x >= 0.3 && x <= 0.8)) return 'bunch';
  const ext = f.map((x) => x < 0.35);
  const n = ext.filter(Boolean).length;
  if (n === 0) return 'fist';
  if (n <= 2 && (ext[0] || ext[3])) return 'point';
  if (n >= 3 && c[0] < 0.35 && (shape?.spread ?? 0) >= 0.7) return 'five';
  return 'flat';
}

/** Which part of the hand makes contact, by handshape family and what is touched. */
const PART = {
  head: { point: 'indexTip', bunch: 'bunchTip', five: 'thumbTip', flat: 'middleTip', fist: 'knuckles' },
  body: { point: 'indexTip', bunch: 'bunchTip', five: 'thumbTip', flat: 'palm', fist: 'knuckles' },
  hand: { point: 'indexTip', bunch: 'bunchTip', five: 'palm', flat: 'palm', fist: 'fistSide' },
  arm: { point: 'indexTip', bunch: 'bunchTip', five: 'palm', flat: 'palm', fist: 'fistSide' },
};
export const contactPart = (style, kind) => (PART[kind] || PART.body)[style];

/**
 * Palm frame for a contact, in model space: f = the fingers' direction, p = the way the
 * palm faces. `normal` is the outward surface normal at the contact (into = -normal).
 */
export function contactFrame(style, kind, side, normal, high = false) {
  const i = inwardOf(side);
  const into = neg(normal);
  const onHand = kind === 'hand' || kind === 'arm';
  const up = v(0, 1, 0), fwd = v(i * 0.3, 0, 1);
  switch (style) {
    // Fingers come in from below and in front at the face (the elbow stays down), level at the body.
    // At the head the index comes up from below (THINK); at the body it points diagonally back
    // across the chest, the forearm lying across the body (I, ME).
    case 'point': return kind === 'head'
      ? { f: add(add(into, v(i * 0.3, 0, 0)), up, 1.2), p: v(i, 0, 0.2) }
      : { f: add(scale(into, 0.75), v(i * 0.65, 0.2, 0)), p: v(i * 0.2, 1, 0) };
    case 'bunch': return { f: add(into, up, kind === 'head' ? 1.6 : 0.3), p: add(v(i * 0.3, -1, 0), into, 0.2) };
    case 'five': return onHand ? { f: fwd, p: into } : { f: v(i * 0.08, 1, 0.1), p: v(i, 0, 0) };
    case 'fist': return onHand ? { f: v(i * 0.25, 0, 1), p: v(i, 0, 0) } : { f: v(i * 0.8, 0.6, 0), p: into };
    default: // flat
      if (onHand) return { f: fwd, p: into };
      // Above the eyes the hand lies across the forehead; lower, the fingertips rise to the lips / chin.
      if (kind === 'head') return high ? { f: v(i, 0.15, 0), p: into } : { f: v(i * 0.15, 1, 0.05), p: into };
      return { f: v(i * 0.7, 0.7, 0), p: add(into, v(i * 0.15, 0, 0)) };
  }
}

/** Palm frame for a hand signing in the space in front of the body (no contact). */
export function freeFrame(style, side, { hint = null, pair = false, moving = false } = {}) {
  const i = inwardOf(side);
  // A pointing hand that moves is pointing AT something (YOU, THERE): index forward, palm down.
  if (style === 'point' && moving) return { f: v(i * 0.12, 0.2, 1), p: v(i * 0.3, -1, 0) };
  if (hint === 'up') return { f: v(i * 0.25, 0.15, 1), p: v(0, 1, 0) };
  if (hint === 'together') return { f: v(0, 1, 0.25), p: v(i, 0, 0) };
  if (pair) { // both hands signing together: palms toward each other
    if (style === 'bunch') return { f: v(i * 0.9, 0.2, 0.4), p: v(0, -0.4, 0.2) };
    if (style === 'point') return { f: v(i * 0.2, 1, 0.4), p: v(i * 0.85, 0, 0.3) };
    return { f: v(i * 0.15, 0.8, 0.6), p: v(i * 0.85, 0, 0.3) };
  }
  if (style === 'point') return { f: v(i * 0.1, 1, 0.35), p: v(i * 0.35, 0, 1) };
  if (style === 'fist') return { f: v(i * 0.2, 1, 0.2), p: v(i * 0.15, -0.2, 1) };
  if (style === 'bunch') return { f: v(i * 0.4, 0.3, 1), p: v(i * 0.4, -1, 0) };
  return { f: v(i * 0.1, 1, 0.35), p: v(i * 0.45, 0, 1) };
}

/** Hanging hand: fingers down, palm against the thigh. */
export const restFrameOf = (side) => ({ f: v(0, -1, 0.12), p: v(inwardOf(side), 0, 0.15) });

/** Where the base (non-dominant) hand is held, and how, for signs made on it. */
const BASE = {
  hand: { point: (i) => v(-i * 0.02, 1.14, 0.3), frame: (site, i) => (/back/.test(site) ? { f: v(i * 0.55, 0, 1), p: v(0, -1, 0) } : /radial|ulnar/.test(site) ? { f: v(i * 0.3, 0, 1), p: v(i, 0, 0) } : { f: v(i * 0.55, 0, 1), p: v(0, 1, 0) }) },
  // The base forearm angles across and forward (as in TRASH, the elbow is out in front, not at the side).
  arm: {
    // For signs at the elbow the whole base arm is held further out, so the elbow is in front of the body.
    point: (i, site) => (site === 'elbow' ? v(-i * 0.06, 1.24, 0.56) : v(-i * 0.02, 1.22, 0.46)),
    frame: (site, i) => ({ f: v(i * 0.75, 0, 0.65), p: v(0, -1, 0) }),
  },
  // Signs on the upper arm (POWER, ENERGY): the base arm is raised in a flex, fist up.
  upperArm: { point: (i) => v(-i * 0.2, 1.42, 0.24), frame: (site, i) => ({ f: v(i * 0.25, 1, 0.1), p: v(i, 0, 0.4) }) },
};
/** Location id -> the site on the base hand / arm. */
const SITE = {
  LX_PALM: 'palm', LX_PALMBACK: 'back', LX_HANDAWAY: 'handNear', LX_FINGERTIP: 'fingertip',
  LX_FINGERBACK: 'fingerBack', LX_FINGERFRONT: 'fingerFront', LX_FINGERRADIAL: 'fingerRadial',
  LX_FINGERULNAR: 'fingerUlnar', LX_HEEL: 'heel',
  LX_FOREARM_FRONT: 'forearmFront', LX_FOREARM_BACK: 'forearmBack', LX_FOREARM_ULNAR: 'forearmUlnar',
  LX_WRIST_FRONT: 'wristFront', LX_WRIST_BACK: 'wristBack', LX_ELBOW: 'elbow', LX_UPPERARM: 'upperArm', LX_ARMAWAY: 'armNear',
};

/** The sign's movement (2D offset in viewBox units) as a model-space offset. */
export function motionDelta(ox, oy, kind, contact, normal, along = null, full = 0) {
  const k = K_TORSO * 1.25;
  if (contact && kind === 'repeat') return scale(normal, Math.hypot(ox, oy) * k); // taps leave and return to the surface
  // ASL-LEX records a path's SHAPE, not its direction (the data's direction is a placeholder).
  // At a body location the path ARRIVES at the contact (THINK, KNOW); a sign that leaves a
  // location travels to its second location as a separate step. In space it goes the way
  // the hand points (YOU).
  if (along && kind === 'stroke' && contact) return scale(normal, (1 - clamp(Math.hypot(ox, oy) / (full || 1), 0, 1)) * 0.1);
  if (along && kind === 'stroke') return scale(along, Math.hypot(ox, oy) * k * 1.2);
  return v(-(ox || 0) * k, -(oy || 0) * k, 0); // the 2D signer's right (+x) is model -x
}
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x / l, a.y / l, a.z / l); };
/** Path direction for movements whose data has no direction of its own (ASL-LEX shapes). */
const pathAlong = (t, frame) => (t.motion?.family === 'straight' || t.motion?.family === 'arc' ? unit(frame.f) : null);

/**
 * Build the AvatarRig.apply input.
 * @param frame   useAnimatedPose frame
 * @param targets computeTargets output (the same snapshot)
 * @param ctx     { vocab, pose, headFamily }
 */
export function realize(frame, targets, { vocab, pose = null, headFamily = null } = {}) {
  const HR = resolveHands(pose?.H, vocab);
  const hints = { right: palmHint(byId(vocab, 'H', HR.right)?.label), left: palmHint(byId(vocab, 'H', HR.left)?.label) };
  const T = targets.hands;
  const hands = {};
  const w = { right: inUse(frame.right.alpha), left: inUse(frame.left.alpha) };
  const styles = { right: handStyle({ curl: frame.right.curl, spread: frame.right.spread }), left: handStyle({ curl: frame.left.curl, spread: frame.left.spread }) };
  const pair = T.right.active && T.left.active && !T.right.contact && !T.left.contact;

  // Signs made on the other hand / arm: the other hand becomes the base and goes first.
  let baseFor = null;
  for (const side of SIDES) if (T[side].contact === 'hand' || T[side].contact === 'arm') { baseFor = side; break; }
  const baseSide = baseFor ? (baseFor === 'right' ? 'left' : 'right') : null;

  for (const side of SIDES) {
    const t = T[side], fr = frame[side];
    const shape = { curl: fr.curl, spread: fr.spread, thumbAngle: fr.thumbAngle };
    const style = styles[side];
    const restPoint = v(-inwardOf(side) * REST_3D.x, REST_3D.y, REST_3D.z);
    const kind = t.motion?.kind ?? null;
    const out = { w: w[side], shape, style, restPoint, restFrame: restFrameOf(side), contact: t.contact, near: t.near };

    if (side === baseSide) {
      const site = SITE[T[baseFor].location] ?? 'palm';
      const B = site === 'upperArm' ? BASE.upperArm : BASE[T[baseFor].contact];
      out.w = Math.max(out.w, w[baseFor]);
      out.goal = { point: B.point(inwardOf(side), site) };
      out.frame = B.frame(site, inwardOf(side));
      out.part = 'center';
      if (!t.active) out.shape = { curl: [0.25, 0, 0, 0, 0], spread: 0 }; // a flat base hand
      out.motion = v(0, 0, 0);
      out.contact = null;
    } else if (t.contact === 'hand' || t.contact === 'arm') {
      out.goal = { site: SITE[t.location] ?? 'palm', on: t.contact, gap: t.near ? 0.08 : 0.006 };
      out.part = t.near ? 'center' : contactPart(style, t.contact);
      out.kind = t.contact;
      out.motion = motionDelta(fr.ox, fr.oy, kind, false, v(0, 1, 0));
    } else if (t.contact) {
      const a = bodyAnchor(byId(vocab, 'L', t.location), side);
      const gap = t.near ? (t.contact === 'head' ? 0.16 : 0.14) : 0.006;
      out.goal = { point: add(a.point, a.normal, gap), normal: a.normal };
      out.part = t.near ? 'center' : contactPart(style, t.contact);
      // A flat hand moving out from the face ends palm up, fingers forward (THANK YOU, GOOD).
      out.frame = t.near && t.contact === 'head' && style === 'flat' ? { f: v(inwardOf(side) * 0.25, 0.35, 1), p: v(inwardOf(side) * 0.15, 1, -0.35) } : contactFrame(style, t.contact, side, a.normal, a.point.y > 1.665);
      out.motion = motionDelta(fr.ox, fr.oy, kind, !t.near, a.normal, pathAlong(t, { f: a.normal }), Math.hypot(t.motion?.x ?? 0, t.motion?.y ?? 0));
    } else {
      // Neutral space, from the 2D anchor (its height and spread), in front of the chest.
      // Two hands signing together are about shoulder-width apart (WANT, GO); only fingertip
      // signs (MORE) and two-palm shapes meet in the middle.
      const y = modelY(t.y);
      const x = !pair ? modelX(t.x, t.y)
        : -inwardOf(side) * (style === 'bunch' ? 0.05 : hints[side] ? 0.06 : PAIR_HALF_WIDTH);
      const z = Math.max(NEUTRAL_Z, (surfaceZ(x, y) ?? 0) + 0.15);
      out.goal = { point: v(x, y + NEUTRAL_LIFT, z) };
      out.part = 'center';
      out.frame = freeFrame(style, side, { hint: hints[side], pair, moving: !!t.motion });
      out.motion = motionDelta(fr.ox, fr.oy, kind, false, v(0, 0, 1), pathAlong(t, out.frame));
    }
    hands[side] = out;
  }

  // Both hands on the same body location (LOVE, crossed on the chest): the dominant hand
  // crosses in front instead of the two hands occupying the same place.
  if (T.right.contact === 'body' && T.left.contact === 'body' && T.right.location === T.left.location && hands.right.goal.point) {
    hands.right.goal.point = add(hands.right.goal.point, v(0.035, 0, 0.03));
    hands.left.goal.point = add(hands.left.goal.point, v(-0.035, 0, 0));
  }

  const hd = frame.head || {};
  const pitchFamily = headFamily === 'forward' || headFamily === 'down';
  const rot = (hd.rot || 0) * DEG;
  const head = {
    roll: pitchFamily ? 0 : rot,
    pitch: (pitchFamily ? rot : 0) + (hd.pitch || 0) * 14 * DEG + (hd.dy || 0) * 0.01,
    yaw: (hd.turn || 0) * 22 * DEG - (hd.dx || 0) * 0.02,
  };
  return { hands, head, face: frame.face, breathe: frame.breathe || 0, order: baseSide ? [baseSide, baseFor] : ['right', 'left'] };
}

export { lerp };
