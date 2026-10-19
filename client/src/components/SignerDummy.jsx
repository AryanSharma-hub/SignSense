import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { computeTargets, describePose } from '../lib/pose.js';
import { solveFigure } from '../lib/rig/solveFigure.js';
import { capsule } from '../lib/rig/draw.js';
import { BODY, SIDES } from '../lib/rig/skeleton.js';
import { useAnimatedPose } from '../hooks/useAnimatedPose.js';
import { AvatarBody, AvatarArm, TORSO_PATH } from './avatar/Body.jsx';
import { AvatarHand } from './avatar/Hand.jsx';
import { AvatarHead, CROWN_PATH } from './avatar/Head.jsx';
import { SkeletonGuide, MotionGuide } from './avatar/Guides.jsx';

const key = (o) => JSON.stringify(o);

/** Camera framings, as viewBoxes over the one 240x300 signer coordinate system. */
export const FRAMINGS = {
  full: { x: 0, y: 0, w: 240, h: 300, label: 'Full' },
  upper: { x: 8, y: 14, w: 224, h: 262, label: 'Signing space' },
  face: { x: 60, y: 22, w: 120, h: 132, label: 'Face' },
};

const SIDE_NAME = { right: 'Right', left: 'Left' };
/** What each body part edits. `k` is the parameter key; the label is what hover and screen readers say. */
const PART_LABEL = {
  E: 'Face — choose an expression',
  HD: 'Head — choose a head movement',
  L: 'Body — choose where the sign is made',
  H: (side) => `${SIDE_NAME[side]} hand — choose a handshape`,
  M: (side) => `${SIDE_NAME[side]} arm — choose a movement`,
};
export const partLabel = (part) => {
  const l = PART_LABEL[part.k];
  return typeof l === 'function' ? l(part.side) : l;
};
const samePart = (a, b) => !!a && !!b && a.k === b.k && (a.side || null) === (b.side || null);

/** Small pill label drawn inside the SVG, so it stays aligned at any framing or size. */
function SvgTag({ x, y, text, tone = 'ink' }) {
  const w = text.length * 4.9 + 12;
  const left = Math.max(4, Math.min(236 - w, x - w / 2));
  const top = Math.max(4, y - 22);
  return (
    <g pointerEvents="none" aria-hidden>
      <rect x={left} y={top} width={w} height="14" rx="7" fill={tone === 'ink' ? 'rgb(var(--ink))' : 'rgb(var(--hand))'} opacity="0.94" />
      <text x={left + w / 2} y={top + 9.6} textAnchor="middle" fontSize="8.4" fontWeight="700" fill="rgb(var(--bg))">{text}</text>
    </g>
  );
}

/**
 * The signer. One component for every use: the main stage (interactive), suggestion
 * mini-previews (compact), and every playback. It only ever receives a pose snapshot
 * {E, HD, L, H, M}; computeTargets turns that into targets, useAnimatedPose animates
 * them, and the rig (lib/rig) solves a full skeleton from the animated hands every frame.
 *
 * Interactive mode overlays a hit-area on each body part. Tapping a part opens its
 * options (onPartSelect); dragging a hand sets its movement, dragging the face sets a
 * head movement. Every hit-area is also a keyboard button.
 */
export function SignerDummy({
  pose, vocab, compact = false, idle = !compact, interactive = false,
  onHandTap, onHeadTap, onDragPreview, onDragCommit, onPartSelect,
  selectedPart = null, editingHand = null,
  locationTargets = null, guides = false, speed = 1, paused = false,
  framing = 'full', fit = 'width', className = '',
}) {
  const targets = useMemo(() => computeTargets(pose, vocab), [key(pose), vocab]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [tag, setTag] = useState(null);
  const [hover, setHover] = useState(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = { skin: `skin${uid}`, face: `face${uid}`, shirt: `shirt${uid}`, eyeL: `eyeL${uid}`, eyeR: `eyeR${uid}` };
  const vb = FRAMINGS[framing] || FRAMINGS.full;

  const effective = useMemo(() => {
    if (!drag) return targets;
    if (drag.kind === 'hand') {
      const h = targets.hands[drag.side];
      return { ...targets, hands: { ...targets.hands, [drag.side]: { ...h, x: h.x + drag.dx, y: h.y + drag.dy, active: true, motion: null } } };
    }
    return { ...targets, head: { ...targets.head, dx: drag.dx * 0.5, dy: drag.dy * 0.35 } };
  }, [targets, drag]);

  const f = useAnimatedPose(effective, { idle, speed, paused });
  const arms = solveFigure(f, effective);

  const toView = useCallback((e) => {
    const r = svgRef.current.getBoundingClientRect();
    // Account for letterboxing when the SVG is fitted inside a box of another aspect ratio.
    const scale = Math.min(r.width / vb.w, r.height / vb.h) || 1;
    const ox = (r.width - vb.w * scale) / 2, oy = (r.height - vb.h * scale) / 2;
    return { x: vb.x + (e.clientX - r.left - ox) / scale, y: vb.y + (e.clientY - r.top - oy) / scale };
  }, [vb]);

  const tap = (part) => {
    if (part.k === 'H') onHandTap?.(part.side);
    if (part.k === 'E') onHeadTap?.();
    onPartSelect?.(part);
  };

  const begin = (e, part, dragKind) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { part, kind: dragKind, side: part.side ?? null, start: toView(e), moved: false, rel: { x: 0, y: 0 } };
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d || !d.kind) return;
    const p = toView(e);
    const rel = { x: p.x - d.start.x, y: p.y - d.start.y };
    if (!d.moved && Math.hypot(rel.x, rel.y) < 6) return; // below the threshold it is still a tap
    d.moved = true; d.rel = rel;
    const lim = d.kind === 'hand' ? 26 : 14, len = Math.hypot(rel.x, rel.y), k = len > lim ? lim / len : 1;
    setDrag({ kind: d.kind, side: d.side, dx: rel.x * k, dy: rel.y * k });
    const text = onDragPreview?.(d.kind, d.side, rel);
    setTag(text ? { x: p.x, y: p.y, text } : null);
  };
  const end = () => {
    const d = dragRef.current;
    dragRef.current = null; setDrag(null); setTag(null);
    if (!d) return;
    if (!d.moved) tap(d.part);
    else onDragCommit?.(d.kind, d.side, d.rel);
  };
  const cancel = () => { dragRef.current = null; setDrag(null); setTag(null); };

  // Keyboard: Enter/Space opens the part's options; arrows on a hand or the face commit a movement.
  const ARROWS = { ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 }, ArrowLeft: { x: -30, y: 0 }, ArrowRight: { x: 30, y: 0 } };
  const keys = (part, dragKind) => (e) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(part); }
    else if (dragKind && ARROWS[e.key]) { e.preventDefault(); onDragCommit?.(dragKind, part.side ?? null, ARROWS[e.key]); }
  };

  /** One focusable, labelled hit-area laid over a body part. */
  const hit = (part, shape, dragKind, at) => {
    const label = partLabel(part) + (dragKind === 'hand' ? '. Drag or use arrow keys for its movement.' : dragKind === 'head' ? '. Drag or use arrow keys for head movement.' : '');
    const props = {
      className: `part-hit${samePart(part, selectedPart) ? ' is-selected' : ''}`,
      tabIndex: 0, role: 'button', 'aria-label': label, 'aria-pressed': samePart(part, selectedPart),
      onPointerDown: (e) => begin(e, part, dragKind), onPointerMove: move, onPointerUp: end, onPointerCancel: cancel,
      onPointerEnter: () => setHover({ part, ...at }), onPointerLeave: () => setHover(null),
      onFocus: () => setHover({ part, ...at }), onBlur: () => setHover(null),
      onKeyDown: keys(part, dragKind),
    };
    return shape(props);
  };

  const label = describePose(pose, vocab);
  const { cx, cy, rx, ry } = BODY.head;
  const armHit = (side) => {
    const a = arms[side], r = BODY.limbRadius;
    return `${capsule(a.shoulder, a.elbow, r.shoulder + 2, r.elbow + 2)} ${capsule(a.elbow, a.wrist, r.elbow + 2, r.wrist + 2)}`;
  };

  return (
    <div className={`relative ${fit === 'contain' ? 'h-full w-full' : ''} ${className}`}>
      <svg
        ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img"
        aria-label={`Signer${label ? `: ${label}` : ' at rest'}`}
        className={`block select-none ${fit === 'contain' ? 'h-full w-full' : 'h-auto w-full'}`}
        style={interactive ? { touchAction: 'none' } : undefined}
      >
        <defs>
          <radialGradient id={ids.skin} cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="rgb(var(--skin-hi))" />
            <stop offset="0.6" stopColor="rgb(var(--skin))" />
            <stop offset="1" stopColor="rgb(var(--skin-shade))" />
          </radialGradient>
          <radialGradient id={ids.face} cx="0.45" cy="0.38" r="0.72">
            <stop offset="0" stopColor="rgb(var(--skin-hi))" />
            <stop offset="0.7" stopColor="rgb(var(--skin))" />
            <stop offset="1" stopColor="rgb(var(--skin-shade))" />
          </radialGradient>
          <linearGradient id={ids.shirt} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--shirt-hi))" />
            <stop offset="1" stopColor="rgb(var(--shirt))" />
          </linearGradient>
        </defs>

        {!compact && <ellipse cx="120" cy="298" rx="78" ry="8" fill="rgb(var(--ink) / 0.10)" />}
        <AvatarBody ids={ids} breathe={f.breathe} />
        <AvatarHead head={f.head} face={f.face} ids={ids} />

        {/* arms + hands, back to front: the more active hand is in front */}
        {arms.order.map((side) => (
          <g key={side}>
            <AvatarArm chain={arms[side]} ids={ids} />
            <AvatarHand
              hand={arms[side].hand} shape={{ curl: f[side].curl, spread: f[side].spread, thumbAngle: f[side].thumbAngle }}
              mirror={side === 'left'} guides={guides} ids={ids}
              ring={!compact && interactive && editingHand === side && !(selectedPart?.k === 'H' && selectedPart.side === side)}
            />
          </g>
        ))}

        {guides && <SkeletonGuide arms={arms} />}
        {guides && <MotionGuide targets={effective} />}

        {/* hit-areas over each body part: torso, arms, face, crown, hands (top-most) */}
        {interactive && (
          <g>
            {hit({ k: 'L' }, (p) => <path d={TORSO_PATH} {...p} />, null, { x: 120, y: 190 })}
            {SIDES.map((side) => (
              <g key={`arm-${side}`}>{hit({ k: 'M', side }, (p) => <path d={armHit(side)} {...p} />, null, { x: arms[side].elbow.x, y: arms[side].elbow.y })}</g>
            ))}
            {hit({ k: 'E' }, (p) => <ellipse cx={cx} cy={cy + 6} rx={rx - 1} ry={ry - 9} {...p} />, 'head', { x: 120, y: 66 })}
            {hit({ k: 'HD' }, (p) => <path d={CROWN_PATH} {...p} />, null, { x: 120, y: 40 })}
            {SIDES.map((side) => (
              <g key={`hand-${side}`}>{hit({ k: 'H', side }, (p) => <circle cx={arms[side].hand.x} cy={arms[side].hand.y - 3} r="17" {...p} />, 'hand', { x: arms[side].hand.x, y: arms[side].hand.y - 16 })}</g>
            ))}
          </g>
        )}

        {/* location targets: where on the body the sign is made */}
        {locationTargets && vocab.locations.map((l) => {
          const on = locationTargets.selected === l.id;
          return (
            <g
              key={l.id} className="loc-dot" role="button" tabIndex={0} aria-label={`Location: ${l.label}`} aria-pressed={on}
              onClick={() => locationTargets.onPick(l.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); locationTargets.onPick(l.id); } }}
            >
              <title>{l.label}</title>
              <circle cx={l.anchorX} cy={l.anchorY} r="9" fill="rgb(var(--location) / 0.16)" stroke="rgb(var(--location))" strokeWidth={on ? 2.2 : 1.1} strokeDasharray={on ? '' : '3 2.5'} />
              <circle className="core" cx={l.anchorX} cy={l.anchorY} r={on ? 4.5 : 3.6} fill="rgb(var(--location))" />
              {on && <text x={l.anchorX + 13} y={l.anchorY + 3.5} fontSize="9" fontWeight="700" fill="rgb(var(--location))" stroke="rgb(var(--surface))" strokeWidth="3" paintOrder="stroke">{l.label}</text>}
            </g>
          );
        })}

        {interactive && !tag && hover && <SvgTag x={hover.x} y={hover.y} text={partLabel(hover.part).split(' — ')[0]} tone="accent" />}
        {tag && <SvgTag x={tag.x} y={tag.y} text={tag.text} />}
      </svg>
    </div>
  );
}
