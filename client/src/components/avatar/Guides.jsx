import { motionPath } from '../../lib/pose.js';
import { points } from '../../lib/rig/draw.js';
import { BODY, SIDES } from '../../lib/rig/skeleton.js';

const BONE = 'rgb(var(--ink) / 0.55)';

/** Skeleton overlay: the solved shoulder -> elbow -> wrist -> hand chain, for learning and debugging. */
export function SkeletonGuide({ arms }) {
  const P = BODY.neckPivot;
  return (
    <g aria-hidden pointerEvents="none">
      <line x1={arms.left.shoulder.x} y1={arms.left.shoulder.y} x2={arms.right.shoulder.x} y2={arms.right.shoulder.y} stroke={BONE} strokeWidth="1" />
      <line x1={P.x} y1={P.y - 40} x2={P.x} y2="230" stroke={BONE} strokeWidth="1" />
      {SIDES.map((side) => {
        const a = arms[side];
        return (
          <g key={side}>
            <polyline points={points([a.shoulder, a.elbow, a.wrist, a.hand])} fill="none" stroke={BONE} strokeWidth="1.1" strokeLinejoin="round" />
            {[a.shoulder, a.elbow, a.wrist].map((j, i) => <circle key={i} cx={j.x} cy={j.y} r="2.3" fill="rgb(var(--surface))" stroke={BONE} strokeWidth="1" />)}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Movement-path overlay: where each moving hand goes — dashed path from a start dot to
 * an arrowhead at the end point, in the movement colour. Paths are drawn from the hand's
 * target anchor, so they show the intended movement, not the eased in-between.
 */
export function MotionGuide({ targets }) {
  return (
    <g aria-hidden pointerEvents="none">
      {SIDES.map((side) => {
        const h = targets.hands[side];
        if (!h?.motion) return null;
        const pts = motionPath(h.motion).map((o) => ({ x: h.x + o.x, y: h.y - 4 + o.y }));
        if (pts.length < 2) return null;
        const extent = Math.max(...pts.map((p) => Math.hypot(p.x - pts[0].x, p.y - pts[0].y)));
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
        return (
          <g key={side}>
            {extent < 1.5
              ? <circle cx={pts[0].x} cy={pts[0].y} r="6" fill="none" stroke="rgb(var(--movement))" strokeWidth="1.6" strokeDasharray="2.5 2" />
              : (
                <>
                  <polyline points={points(pts)} fill="none" stroke="rgb(var(--surface))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
                  <polyline points={points(pts)} fill="none" stroke="rgb(var(--movement))" strokeWidth="1.8" strokeDasharray="3.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={pts[0].x} cy={pts[0].y} r="2.6" fill="rgb(var(--movement))" />
                  <path d="M0 0L-6 -3.4L-6 3.4Z" fill="rgb(var(--movement))" transform={`translate(${b.x} ${b.y}) rotate(${ang})`} />
                </>
              )}
          </g>
        );
      })}
    </g>
  );
}
