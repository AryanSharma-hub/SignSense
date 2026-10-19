import { BODY, LIMITS, DEG, clamp, normDeg, rotate, sideSign, elbowPole } from './skeleton.js';

/**
 * Analytic two-bone IK (shoulder -> elbow -> wrist) in the viewBox plane.
 *
 * The bend side comes from a pole vector (the component of `pole` perpendicular to the
 * shoulder->target line), so the elbow always folds outward-and-down instead of picking
 * whichever of the two mathematical solutions happens to score higher — that choice
 * flipping between frames is what made elbows jump across the body.
 *
 * Reach is clamped between the fully extended arm and the tightest legal elbow fold
 * (LIMITS.elbowMinDeg), so the result is always anatomically possible; `stretch` reports
 * how far the target was out of reach (positive) or too close (negative).
 */
export function solveTwoBone(S, T, L1, L2, pole, minElbowDeg = LIMITS.elbowMinDeg) {
  const dx = T.x - S.x, dy = T.y - S.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d, uy = dy / d;
  const max = L1 + L2 - 0.01;
  const min = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(minElbowDeg * DEG));
  const reach = clamp(d, min, max);
  const a = (L1 * L1 - L2 * L2 + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  const pd = pole.x * ux + pole.y * uy;
  let px = pole.x - pd * ux, py = pole.y - pd * uy;
  const pl = Math.hypot(px, py);
  if (pl < 1e-4) { px = -uy; py = ux; } else { px /= pl; py /= pl; }

  return {
    elbow: { x: S.x + ux * a + px * h, y: S.y + uy * a + py * h },
    wrist: { x: S.x + ux * reach, y: S.y + uy * reach },
    stretch: d - reach,
  };
}

/** Interior elbow angle in degrees (180 = straight arm). */
export function elbowAngle(S, E, W) {
  const a = { x: S.x - E.x, y: S.y - E.y }, b = { x: W.x - E.x, y: W.y - E.y };
  const cos = (a.x * b.x + a.y * b.y) / ((Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)) || 1);
  return Math.acos(clamp(cos, -1, 1)) / DEG;
}

/** Angle (deg, SVG convention, 0 = up) a hand would have if it continued the forearm's line. */
const followAngle = (E, W) => normDeg(Math.atan2(W.y - E.y, W.x - E.x) / DEG + 90);

/** Wrist position for a hand whose origin is at H, rotated by `deg`. */
const wristFor = (H, deg) => { const o = rotate(0, BODY.wristToPalm, deg); return { x: H.x + o.x, y: H.y + o.y }; };

/**
 * Solve one arm for a desired hand position.
 *
 * `hand.w` (0..1) is how "in use" the hand is: 0 hangs relaxed with the wrist straight
 * (fingers continuing the forearm, i.e. pointing down at rest); 1 holds the hand upright
 * in signing space, with the wrist bend limited to LIMITS.wristDeg. Values in between
 * blend smoothly, so raising a hand never snaps.
 *
 * Iterated: the wrist position depends on the hand's angle, which depends on the
 * forearm, which depends on the wrist. Two refinements converge visually exactly.
 *
 * Returns the full chain from the shoulder down. The hand origin is recomputed by forward
 * kinematics from the solved wrist, so the hand can never detach from the arm.
 */
export function solveArm(side, hand) {
  const sx = sideSign(side);
  const w = clamp(hand.w ?? 1, 0, 1);
  const base = BODY.shoulder[side];
  const pole = elbowPole(side);
  const L1 = BODY.upperArm, L2 = BODY.forearm;

  // Shoulders rise a little when the hand works above them, more if the target is out of reach.
  const above = clamp((base.y - hand.y) / 70, 0, 1);
  let S = { x: base.x - sx * above * 2, y: base.y - above * 4 * w };

  let angle = sx * 180 * (1 - w); // first guess: hanging (fingers down) .. upright
  let sol = null;
  // Solve with the current wrist angle, then refine the angle from the solved forearm.
  // The last solve uses the angle the hand is drawn with, so hand and wrist always agree.
  for (let pass = 0; pass < 3; pass++) {
    sol = solveTwoBone(S, wristFor(hand, angle), L1, L2, pole);
    if (pass === 0 && sol.stretch > 0.5) {
      const lift = Math.min(sol.stretch, LIMITS.shoulderLift);
      const dx = hand.x - S.x, dy = hand.y - S.y, d = Math.hypot(dx, dy) || 1;
      S = { x: S.x + (dx / d) * lift * 0.5, y: S.y + (dy / d) * lift };
      sol = solveTwoBone(S, wristFor(hand, angle), L1, L2, pole);
    }
    if (pass === 2) break;
    const follow = followAngle(sol.elbow, sol.wrist);
    const bend = clamp(normDeg(0 - follow), -LIMITS.wristDeg, LIMITS.wristDeg);
    angle = follow + bend * w;
  }

  const off = rotate(0, -BODY.wristToPalm, angle);
  return {
    shoulder: S,
    elbow: sol.elbow,
    wrist: sol.wrist,
    hand: { x: sol.wrist.x + off.x, y: sol.wrist.y + off.y, angle: normDeg(angle) },
    stretch: sol.stretch,
  };
}
