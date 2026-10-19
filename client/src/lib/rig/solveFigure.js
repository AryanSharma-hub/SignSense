import { BODY, LIMITS, SIDES } from './skeleton.js';
import { solveArm } from './ik.js';

/** Clearance kept between a hand's origin and the face outline when no face contact is meant. */
const FACE_CLEARANCE = 10;

/**
 * Keep a hand out of the face unless the sign is made AT the face. Signs located on the
 * head (`contact === 'head'`) legitimately touch it, so they are left exactly as authored.
 */
export function guardFace(p, contact) {
  if (contact === 'head') return p;
  const { cx, cy, rx, ry } = BODY.head;
  const ex = rx + FACE_CLEARANCE, ey = ry + FACE_CLEARANCE;
  const nx = (p.x - cx) / ex, ny = (p.y - cy) / ey;
  const r = Math.hypot(nx, ny);
  if (r >= 1 || r === 0) return p;
  return { x: cx + (nx / r) * ex, y: cy + (ny / r) * ey };
}

/**
 * Ease two independent hands apart when they would pass through each other. Joined
 * (two-palm) signs are left alone: there the hands are meant to meet.
 */
export function separateHands(right, left, joined) {
  if (joined) return { right, left };
  const dx = right.x - left.x, dy = right.y - left.y;
  const d = Math.hypot(dx, dy);
  const gap = LIMITS.handGap * Math.min(right.w ?? 1, left.w ?? 1);
  if (d >= gap) return { right, left };
  // Push along the line between them, or sideways (right hand to the viewer's right) if they coincide.
  const ux = d > 1e-3 ? dx / d : 1, uy = d > 1e-3 ? dy / d : 0;
  const push = (gap - d) / 2;
  return {
    right: { ...right, x: right.x + ux * push, y: right.y + uy * push },
    left: { ...left, x: left.x - ux * push, y: left.y - uy * push },
  };
}

/**
 * Animated frame -> solved skeleton for both arms.
 *
 * @param {{right:{x,y,alpha}, left:{x,y,alpha}}} frame  animated hand origins
 * @param {{joined?:boolean, hands?:{right?:{contact}, left?:{contact}}}} targets
 * @returns {{right, left, order:string[]}} per-side chain from solveArm, and the draw
 *   order (back to front): the more-active hand is drawn in front; ties go to the
 *   dominant right hand.
 */
export function solveFigure(frame, targets = {}) {
  const w = (a) => Math.max(0, Math.min(1, ((a ?? 1) - 0.4) / 0.6));
  let want = {};
  for (const side of SIDES) {
    const h = frame[side];
    want[side] = { x: h.x, y: h.y, w: w(h.alpha) };
  }
  want = separateHands(want.right, want.left, !!targets.joined);
  const arms = {};
  for (const side of SIDES) {
    const p = guardFace(want[side], targets.hands?.[side]?.contact);
    arms[side] = solveArm(side, { ...want[side], ...p });
  }
  const order = want.left.w > want.right.w + 0.05 ? ['right', 'left'] : ['left', 'right'];
  return { ...arms, order };
}
