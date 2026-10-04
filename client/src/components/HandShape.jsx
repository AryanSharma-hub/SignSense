import { handGeometry, toPoints, PALM } from '../lib/handGeometry.js';

/** One CSS var per digit, in `all` order (index, middle, ring, pinky, thumb) — a fixed,
 * consistent hue per finger so a handshape's curl pattern reads at a glance, on every
 * hand render in the app (stage, mini-previews, picker glyphs). */
const DIGIT_VARS = ['--finger-index', '--finger-middle', '--finger-ring', '--finger-pinky', '--finger-thumb'];

/**
 * Draws one parametric hand at the local origin. `mirror` flips it for the left hand
 * (its own <g>, so it never shares an element with the positioning transform).
 */
export function HandShape({ shape, mirror = false, active = false }) {
  const { fingers, thumb } = handGeometry(shape);
  const fill = 'rgb(var(--dummy-fill))';
  const outline = active ? 'rgb(var(--dummy-fill))' : 'rgb(var(--dummy-line))';
  const all = [...fingers, thumb];
  const digitColor = (i) => `rgb(var(${DIGIT_VARS[i]}) / ${active ? 1 : 0.5})`;
  return (
    <g style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      {all.map((p, i) => (
        <polyline key={`o${i}`} points={toPoints(p)} fill="none" stroke={digitColor(i)} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={PALM.x} y={PALM.y} width={PALM.w} height={PALM.h} rx={PALM.r} fill={fill} stroke={outline} strokeWidth="1.8" />
      {all.map((p, i) => (
        <polyline key={`f${i}`} points={toPoints(p)} fill="none" stroke={fill} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* skeleton rig: a thin line + joint dots along each finger's own bones, so the
          articulation from palm to fingertip reads clearly at a glance. */}
      {all.map((p, i) => (
        <polyline key={`rig${i}`} points={toPoints(p)} fill="none" stroke="rgb(var(--ink) / 0.3)" strokeWidth="0.9" strokeLinecap="round" />
      ))}
      {all.flatMap((p, i) => p.map((pt, j) => (
        <circle key={`rigdot${i}-${j}`} cx={pt[0]} cy={pt[1]} r="1" fill="rgb(var(--ink) / 0.4)" />
      )))}
    </g>
  );
}

/** Small static hand icon for pickers (replaces the v1 emoji). */
export function HandGlyph({ shape, size = 38, mirror = false }) {
  return (
    <svg viewBox="-16 -26 32 40" width={size} height={(size * 40) / 32} aria-hidden="true">
      <HandShape shape={shape} mirror={mirror} active />
    </svg>
  );
}
