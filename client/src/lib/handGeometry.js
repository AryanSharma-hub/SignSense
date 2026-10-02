/**
 * Parametric hand: fingers are two-segment polylines driven by per-finger curl (0..1)
 * and a global spread (0..1); the thumb has its own curl and optional resting angle.
 * Local coordinates: origin near the palm centre, fingers point up (-y), thumb on the -x
 * side (mirror the group for the other hand). Pure, so it is unit-testable.
 */
const RAD = Math.PI / 180;
const BASE_X = [-5.4, -1.8, 1.8, 5.4];      // index, middle, ring, pinky
const LEN = [15, 17, 15, 11.5];
const SPREAD_DEG = [-15, -5, 5, 15];
export const PALM = { x: -8, y: -4, w: 16, h: 14, r: 5.5 };

const clamp01 = (v) => Math.max(0, Math.min(1, v ?? 0));
const pt = (x, y) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100];

export function handGeometry(shape) {
  const curl = shape?.curl || [0, 0, 0, 0, 0];
  const spread = clamp01(shape?.spread);
  const thumbAngle = shape?.thumbAngle ?? -55;

  const fingers = BASE_X.map((bx, i) => {
    const c = clamp01(curl[i + 1]);
    const ang = spread * SPREAD_DEG[i] * RAD;
    const l1 = LEN[i] * 0.58 * (1 - 0.5 * c);
    const l2 = LEN[i] * 0.42 * (1 - 0.75 * c);
    const hook = (i < 2 ? 1 : -1) * c * 0.7;         // curled fingers hook toward the palm centre
    const p1 = [bx + l1 * Math.sin(ang), -4 - l1 * Math.cos(ang)];
    const p2 = [p1[0] + l2 * Math.sin(ang + hook), p1[1] - l2 * Math.cos(ang + hook)];
    return [pt(bx, -4), pt(...p1), pt(...p2)];
  });

  const tc = clamp01(curl[0]);
  const ta = (thumbAngle + (62 - thumbAngle) * tc) * RAD; // extended -> folded across the palm
  const tl1 = 8 * (1 - 0.2 * tc), tl2 = 6 * (1 - 0.3 * tc);
  const t0 = [-7, 3];
  const t1 = [t0[0] + tl1 * Math.sin(ta), t0[1] - tl1 * Math.cos(ta)];
  const t2 = [t1[0] + tl2 * Math.sin(ta + 0.25), t1[1] - tl2 * Math.cos(ta + 0.25)];

  return { fingers, thumb: [pt(...t0), pt(...t1), pt(...t2)] };
}

export const toPoints = (pts) => pts.map((p) => p.join(',')).join(' ');
