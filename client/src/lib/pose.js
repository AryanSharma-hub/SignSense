import { byId } from './vocabulary.js';
import { resolveHands } from './resolveHands.js';
import { BODY } from './rig/skeleton.js';

/** Signer viewBox and rest geometry (240x300, same coordinates as v1). */
export const VIEW = { w: 240, h: 300 };
// Hands hang at the sides (arms nearly straight) when not in use; when a sign is made with no location, it happens
// in neutral signing space in front of the chest.
export const REST = { right: { x: 176, y: 234 }, left: { x: 64, y: 234 } };
export const NEUTRAL = { right: { x: 156, y: 184 }, left: { x: 84, y: 184 }, joined: { x: 120, y: 180 } };
/** Shoulder joints come from the skeleton (lib/rig/skeleton.js) so pose and rig never disagree. */
export const SHOULDER = BODY.shoulder;
export const REACH = 20;
export const PAD = 14;
/** Locations describe where the FINGERTIPS make contact; the hand origin sits this far below. */
export const CONTACT_DY = 16;

export const VEC = {
  N: { x: 0, y: -1 }, NE: { x: 0.7, y: -0.7 }, E: { x: 1, y: 0 }, SE: { x: 0.7, y: 0.7 },
  S: { x: 0, y: 1 }, SW: { x: -0.7, y: 0.7 }, W: { x: -1, y: 0 }, NW: { x: -0.7, y: -0.7 },
  CENTER: { x: 0, y: 0 }, PATTERN: { x: 0, y: 0 },
};

export const RELAXED_SHAPE = { curl: [0.25, 0.2, 0.2, 0.22, 0.28], spread: 0.15 };

export const clampXY = (x, y) => ({
  x: Math.max(PAD, Math.min(VIEW.w - PAD, x)),
  y: Math.max(PAD, Math.min(VIEW.h - PAD, y)),
});

/**
 * How a movement animates once the hand is at its anchor:
 *   stroke   — travel once along the compass vector (forward / inward / static families)
 *   repeat   — tap out-and-back
 *   lateral  — side-to-side shake
 *   circular — orbit
 */
export function motionFor(mv, side, joined) {
  if (!mv) return null;
  const v = VEC[mv.dir] || { x: 0, y: 0 };
  switch (mv.family) {
    case 'repeat': {
      const has = v.x !== 0 || v.y !== 0;
      return { kind: 'repeat', x: has ? v.x * 4 : 0, y: has ? v.y * 4 : -4 };
    }
    case 'lateral':  return { kind: 'lateral', amp: 8 };
    case 'circular': return { kind: 'circular', r: 7 };
    default: {
      // Left hand mirrors x so "outward" reads correctly from that side (v1 behaviour).
      const mirror = side === 'left' && !joined ? -1 : 1;
      const xReach = joined ? 10 : REACH;
      // `family` lets a renderer tell a data-placeholder direction (ASL-LEX path shapes) from an authored one.
      return { kind: 'stroke', x: v.x * xReach * mirror, y: v.y * REACH, family: mv.family };
    }
  }
}

/** Location family -> what the hand touches. */
const CONTACT_OF = { head: 'head', hand: 'hand', arm: 'arm' };

/**
 * Pure: pose snapshot {E,HD,L,H,M} -> everything the renderer needs to draw it.
 * Whether a step is "joined" or "independent" is read directly off the snapshot's own
 * right/left values (via resolveHands) — never guessed — so editing, playback and
 * Direction B always agree.
 */
export function computeTargets(pose, vocab) {
  const q = pose || {};
  const expr = byId(vocab, 'E', q.E);
  const head = byId(vocab, 'HD', q.HD);
  // "Signing space" is a destination in front of the body, not a body location.
  const at = byId(vocab, 'L', q.L);
  const loc = at?.family === 'neutral' ? null : at;
  const HR = resolveHands(q.H, vocab);
  const M = q.M || { right: null, left: null };
  const joined = HR.joined;
  const sharedM = joined ? (M.right || M.left) : null;

  const hands = {};
  for (const side of ['right', 'left']) {
    const sx = side === 'right' ? 1 : -1;
    const handId = HR[side];
    const mvId = joined ? sharedM : M[side];
    const active = joined || !!(handId || mvId);
    let anchor = { ...REST[side] };
    if (active) {
      if (loc) {
        // Signs at the face are made beside it, so the hand never covers the eyes or mouth.
        const lateral = loc.family === 'head' ? (joined ? 14 : 24) : joined ? 9 : 10;
        anchor = { x: loc.anchorX + sx * lateral, y: loc.anchorY + CONTACT_DY };
      } else if (joined) anchor = { x: NEUTRAL.joined.x + sx * 9, y: NEUTRAL.joined.y };
      else anchor = { ...NEUTRAL[side] };
    }
    const c = clampXY(anchor.x, anchor.y);
    hands[side] = {
      x: c.x, y: c.y, active,
      // What the hand is meant to touch: 'head' signs may contact the face, so the rig's
      // collision guard leaves them alone; everything else is kept clear of it. 'hand' and
      // 'arm' locations are on the OTHER hand / arm.
      contact: active && loc ? (CONTACT_OF[loc.family] ?? 'body') : null,
      /** The location's id, and whether it is only NEAR the place (ASL-LEX "...Away": no touch). */
      location: active && loc ? loc.id : null,
      near: !!(active && loc && /AWAY$/.test(loc.id)),
      shape: byId(vocab, 'H', handId)?.shape || RELAXED_SHAPE,
      motion: active ? motionFor(byId(vocab, 'M', mvId), side, joined) : null,
    };
  }

  return {
    face: expr?.family || 'neutral',
    head: { rot: head?.rot || 0, motion: head?.motion || null, dx: 0, dy: 0 },
    joined,
    hands,
  };
}

const easeOut = (p) => 1 - Math.pow(1 - p, 3);
export const MOTION_SECONDS = 3;

/** Offset added on top of a hand's anchor, `t` seconds after the pose changed. */
export function motionOffset(motion, t) {
  if (!motion) return { x: 0, y: 0 };
  const env = t < MOTION_SECONDS - 0.4 ? 1 : Math.max(0, (MOTION_SECONDS - t) / 0.4);
  const tau = Math.PI * 2;
  switch (motion.kind) {
    case 'stroke': { const p = easeOut(Math.min(1, t / 0.45)); return { x: motion.x * p, y: motion.y * p }; }
    case 'repeat': { const s = Math.abs(Math.sin((t * tau) / 0.55)) * env; return { x: motion.x * s, y: motion.y * s }; }
    case 'lateral': return { x: motion.amp * Math.sin((t * tau) / 0.6) * env, y: 0 };
    case 'circular': { const a = (t * tau) / 0.9; return { x: motion.r * Math.sin(a) * env, y: motion.r * (Math.cos(a) - 1) * env }; }
    default: return { x: 0, y: 0 };
  }
}

/** Head rotation offset (degrees) for nod / shake, on top of the static tilt. */
export function headMotionOffset(head, t) {
  if (!head?.motion) return 0;
  const env = t < MOTION_SECONDS - 0.4 ? 1 : Math.max(0, (MOTION_SECONDS - t) / 0.4);
  const tau = Math.PI * 2;
  if (head.motion === 'shake') return 9 * Math.sin((t * tau) / 0.55) * env;
  if (head.motion === 'nod') return -head.rot * (1 - Math.abs(Math.sin((t * Math.PI) / 0.7))) * env; // dips into the tilt, returns
  return 0;
}

/**
 * Head movement on three axes for the 2.5D head: `rot` (tilt, degrees), `turn` (shake,
 * -1..1 left/right yaw shown by shifting the features) and `pitch` (nod, -1..1).
 */
export function headMotion(head, t) {
  const out = { rot: 0, turn: 0, pitch: 0 };
  if (!head?.motion) return out;
  const env = t < MOTION_SECONDS - 0.4 ? 1 : Math.max(0, (MOTION_SECONDS - t) / 0.4);
  const tau = Math.PI * 2;
  if (head.motion === 'shake') out.turn = Math.sin((t * tau) / 0.55) * env;
  if (head.motion === 'nod') {
    const dip = Math.abs(Math.sin((t * Math.PI) / 0.7)) * env;
    out.pitch = dip;
    out.rot = headMotionOffset(head, t) * 0.4;
  }
  return out;
}

/**
 * Sample a movement's path (offsets from the hand's anchor) for the path overlay: one
 * stroke, or one cycle of a repeating movement. The last point is where the arrow ends.
 */
export function motionPath(motion, samples = 24) {
  if (!motion) return [];
  const span = { stroke: 0.45, repeat: 0.275, lateral: 0.6, circular: 0.9 }[motion.kind] ?? 0.5;
  const from = motion.kind === 'lateral' ? -0.15 : 0;
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(motionOffset(motion, from + (span * i) / samples));
  return pts;
}

/** Human-readable one-liner of a pose, for captions and screen readers. */
export function describePose(pose, vocab) {
  const q = pose || {};
  const HR = resolveHands(q.H, vocab);
  const parts = [];
  if (HR.joined) parts.push(`Both hands: ${byId(vocab, 'H', HR.right)?.label ?? '—'}`);
  else {
    if (HR.right) parts.push(`Right hand: ${byId(vocab, 'H', HR.right)?.label}`);
    if (HR.left) parts.push(`Left hand: ${byId(vocab, 'H', HR.left)?.label}`);
  }
  const mr = byId(vocab, 'M', q.M?.right), ml = byId(vocab, 'M', q.M?.left);
  if (mr && ml && mr.id === ml.id) parts.push(`Movement: ${mr.label}`);
  else { if (mr) parts.push(`Right movement: ${mr.label}`); if (ml) parts.push(`Left movement: ${ml.label}`); }
  const l = byId(vocab, 'L', q.L); if (l) parts.push(`Location: ${l.label}`);
  const e = byId(vocab, 'E', q.E); if (e) parts.push(`Face: ${e.label}`);
  const h = byId(vocab, 'HD', q.HD); if (h) parts.push(`Head: ${h.label}`);
  return parts.join(' · ');
}
