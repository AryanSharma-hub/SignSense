import { capsule, lerpPt } from '../../lib/rig/draw.js';
import { BODY } from '../../lib/rig/skeleton.js';

/** Torso silhouette (shirt), shared by the drawing and the torso hit-area. */
export const TORSO_PATH =
  'M106 133C96 139 84 140 74 145C63 150 59 160 61 173L69 198C71 232 71 266 71 300L169 300C169 266 169 232 171 198L179 173C181 160 177 150 166 145C156 140 144 139 134 133Z';

/** Neck, torso and collar: the static back layer of the figure. `ids` scopes gradient ids per instance. */
export function AvatarBody({ ids, breathe = 0 }) {
  return (
    <g style={{ transform: `translateY(${breathe}px)` }}>
      <path d="M108 104h24v34c0 6-24 6-24 0Z" fill={`url(#${ids.skin})`} stroke="rgb(var(--skin-line))" strokeWidth="1.2" />
      <path d="M108 112c6 6 18 6 24 0v8c-6 5-18 5-24 0Z" fill="rgb(var(--skin-shade))" opacity="0.45" />
      <path d={TORSO_PATH} fill={`url(#${ids.shirt})`} stroke="rgb(var(--shirt-line))" strokeWidth="1.6" strokeLinejoin="round" />
      {/* V-neck opening and collar */}
      <path d="M107 134L120 152L133 134C128 137 112 137 107 134Z" fill={`url(#${ids.skin})`} />
      <path d="M105 133L120 154L135 133" fill="none" stroke="rgb(var(--shirt-line))" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* soft side shading and a centre fold so the torso reads as a volume, not a flat card */}
      <path d="M71 205C73 240 72 270 72 300" fill="none" stroke="rgb(var(--shirt-shade))" strokeWidth="7" opacity="0.55" />
      <path d="M169 205C167 240 168 270 168 300" fill="none" stroke="rgb(var(--shirt-shade))" strokeWidth="7" opacity="0.55" />
      <path d="M120 160V300" fill="none" stroke="rgb(var(--shirt-line))" strokeWidth="0.8" opacity="0.35" />
    </g>
  );
}

/**
 * One sleeved arm from a solved chain (shoulder -> elbow -> wrist). Drawn as two passes —
 * all outlines, then all fills — so the elbow joint shows no seam between segments.
 */
export function AvatarArm({ chain, ids }) {
  const { shoulder: S, elbow: E, wrist: W } = chain;
  const r = BODY.limbRadius;
  const upper = capsule(S, E, r.shoulder, r.elbow);
  const fore = capsule(E, W, r.elbow, r.wrist);
  const cuff = capsule(lerpPt(E, W, 0.84), W, r.wrist + 0.9, r.wrist + 0.9);
  const line = 'rgb(var(--shirt-line))';
  return (
    <g>
      <path d={upper} fill={line} stroke={line} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={fore} fill={line} stroke={line} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={upper} fill={`url(#${ids.shirt})`} />
      <path d={fore} fill={`url(#${ids.shirt})`} />
      <circle cx={E.x} cy={E.y} r={r.elbow - 0.2} fill={`url(#${ids.shirt})`} />
      <path d={cuff} fill="rgb(var(--shirt-shade))" stroke="rgb(var(--shirt-line))" strokeWidth="1" />
    </g>
  );
}
