/** SVG path helpers for the avatar. Pure string builders, no React. */

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * A tapered limb segment from A (radius ra) to B (radius rb) with rounded ends — one
 * closed outline, so a stroke draws a clean silhouette with no seam at the joints.
 */
export function capsule(A, B, ra, rb) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L, ny = dx / L;
  const p = (P, r, s) => `${r2(P.x + nx * r * s)} ${r2(P.y + ny * r * s)}`;
  return `M${p(A, ra, 1)} L${p(B, rb, 1)} A${r2(rb)} ${r2(rb)} 0 0 0 ${p(B, rb, -1)} L${p(A, ra, -1)} A${r2(ra)} ${r2(ra)} 0 0 0 ${p(A, ra, 1)}Z`;
}

/** Polyline points attribute from [{x,y}] or [[x,y]]. */
export const points = (pts) => pts.map((p) => (Array.isArray(p) ? p.join(',') : `${r2(p.x)},${r2(p.y)}`)).join(' ');

/** Point a fraction `t` of the way from A to B. */
export const lerpPt = (A, B, t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
