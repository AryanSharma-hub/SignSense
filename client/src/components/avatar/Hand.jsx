import { handGeometry, toPoints, PALM } from '../../lib/handGeometry.js';
import { BODY } from '../../lib/rig/skeleton.js';

/** Fixed hue per digit (index, middle, ring, pinky, thumb) — shown only with the guides on. */
const DIGIT_VARS = ['--finger-index', '--finger-middle', '--finger-ring', '--finger-pinky', '--finger-thumb'];

/**
 * The avatar's hand: a skin-toned palm with jointed fingers from the same parametric
 * geometry as the picker glyphs (lib/handGeometry.js), placed at its solved origin and
 * rotated to the solved wrist angle. Draw order is depth order: extended fingers sit
 * behind the palm edge, curled fingers fold over the palm, the thumb is in front.
 */
export function AvatarHand({ hand, shape, mirror = false, guides = false, ring = false, ids }) {
  const { fingers, thumb } = handGeometry(shape);
  const s = BODY.handScale;
  const curl = shape?.curl || [];
  const extended = fingers.map((p, i) => ({ p, i })).filter(({ i }) => (curl[i + 1] ?? 0) < 0.5);
  const folded = fingers.map((p, i) => ({ p, i })).filter(({ i }) => (curl[i + 1] ?? 0) >= 0.5);
  const digit = (p, key) => (
    <g key={key}>
      <polyline points={toPoints(p)} fill="none" stroke="rgb(var(--skin-line))" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={toPoints(p)} fill="none" stroke="rgb(var(--skin))" strokeWidth="3.7" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  return (
    <g transform={`translate(${hand.x} ${hand.y}) rotate(${hand.angle}) scale(${mirror ? -s : s} ${s})`}>
      {ring && <circle cy="2" r="17" fill="rgb(var(--hand) / 0.12)" stroke="rgb(var(--hand) / 0.75)" strokeWidth="1" strokeDasharray="3 2" />}
      {extended.map(({ p, i }) => digit(p, `x${i}`))}
      {/* wrist bridge into the cuff, then the palm */}
      <rect x="-5" y="7" width="10" height="5" rx="2" fill={`url(#${ids.skin})`} stroke="rgb(var(--skin-line))" strokeWidth="0.9" />
      <rect x={PALM.x} y={PALM.y} width={PALM.w} height={PALM.h} rx={PALM.r} fill={`url(#${ids.skin})`} stroke="rgb(var(--skin-line))" strokeWidth="1.1" />
      <path d="M-4 5q4 2 8 0" fill="none" stroke="rgb(var(--skin-shade))" strokeWidth="0.8" strokeLinecap="round" />
      {folded.map(({ p, i }) => digit(p, `f${i}`))}
      {digit(thumb, 't')}
      {guides && [...fingers, thumb].map((p, i) => (
        <g key={`g${i}`}>
          <polyline points={toPoints(p)} fill="none" stroke="rgb(var(--ink) / 0.55)" strokeWidth="0.6" strokeLinecap="round" />
          <circle cx={p[2][0]} cy={p[2][1]} r="1.6" fill={`rgb(var(${DIGIT_VARS[i]}))`} />
        </g>
      ))}
    </g>
  );
}
