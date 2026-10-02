import { handGeometry, toPoints, PALM } from '../lib/handGeometry.js';

/**
 * Draws one parametric hand at the local origin. `mirror` flips it for the left hand
 * (its own <g>, so it never shares an element with the positioning transform).
 */
export function HandShape({ shape, mirror = false, active = false }) {
  const { fingers, thumb } = handGeometry(shape);
  const line = active ? 'rgb(var(--hand))' : 'rgb(var(--dummy-line))';
  const fill = 'rgb(var(--dummy-fill))';
  const all = [...fingers, thumb];
  return (
    <g style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
      {all.map((p, i) => (
        <polyline key={`o${i}`} points={toPoints(p)} fill="none" stroke={line} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <rect x={PALM.x} y={PALM.y} width={PALM.w} height={PALM.h} rx={PALM.r} fill={fill} stroke={line} strokeWidth="1.8" />
      {all.map((p, i) => (
        <polyline key={`f${i}`} points={toPoints(p)} fill="none" stroke={fill} strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
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
