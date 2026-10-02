import { useCallback, useMemo, useRef, useState } from 'react';
import { HandShape } from './HandShape.jsx';
import { computeTargets, describePose, SHOULDER, VIEW } from '../lib/pose.js';
import { useAnimatedPose } from '../hooks/useAnimatedPose.js';

const INK = 'rgb(var(--ink) / 0.82)';
const feature = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const eye = (cx, r = 3.2) => <circle key={cx} cx={cx} cy="73" r={r} fill={INK} />;

/** Layered facial features, one layer per expression family, cross-faded by opacity. */
const FACES = {
  neutral: (<>{eye(105)}{eye(135)}<path {...feature} d="M97 61h16M127 61h16M110 99h20" /></>),
  positive: (<>{eye(105)}{eye(135)}<path {...feature} d="M97 60q8-4 16 0M127 60q8-4 16 0M104 94q16 16 32 0" /></>),
  negative: (<>{eye(105)}{eye(135)}<path {...feature} d="M97 57l15 7M143 57l-15 7M107 103q13-12 26 0" /></>),
  urgent: (<>{eye(105, 3.4)}{eye(135, 3.4)}<path {...feature} d="M95 55l18 11M145 55l-18 11M116 52v6M124 52v6" /><circle cx="120" cy="99" r="3.6" {...feature} /></>),
  polite: (<>{eye(105, 4.2)}{eye(135, 4.2)}<circle cx="106.4" cy="71.6" r="1.3" fill="rgb(var(--surface))" /><circle cx="136.4" cy="71.6" r="1.3" fill="rgb(var(--surface))" /><path {...feature} d="M97 64l15-8M143 64l-15-8M111 98q9 5 18 0" /></>),
  questioning: (<>{eye(105, 3.4)}{eye(135, 3.4)}<path {...feature} d="M96 55q9-8 18-1M126 54q9-7 18 1M111 99h18" /></>),
  surprised: (<><circle cx="105" cy="72" r="5.2" {...feature} /><circle cx="135" cy="72" r="5.2" {...feature} /><path {...feature} d="M97 50q8-6 16 0M127 50q8-6 16 0" /><ellipse cx="120" cy="99" rx="5" ry="6.5" {...feature} /></>),
};

const key = (o) => JSON.stringify(o);

const L1 = 46, L2 = 46; // upper arm / forearm length in viewBox units
/**
 * Two-bone IK: find the elbow, then draw a smooth bezier limb through shoulder, elbow and wrist.
 * Far from the shoulder the elbow swings out and down; with the hand right beside the
 * shoulder (chin / mouth signs) it simply hangs straight down, blended so it never snaps.
 */
function armPath(S, W, sx) {
  const dx = W.x - S.x, dy = W.y - S.y;
  const d = Math.hypot(dx, dy) || 1;
  const reach = Math.min(d, L1 + L2 - 0.5);
  const mid = { x: (S.x + W.x) / 2, y: (S.y + W.y) / 2 };

  const hDown = Math.sqrt(Math.max(0, L1 * L1 - (reach / 2) ** 2));
  const down = { x: mid.x + sx * 4, y: mid.y + hDown };

  const ux = dx / d, uy = dy / d;
  const a = (L1 * L1 - L2 * L2 + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const px = -uy, py = ux;
  const e1 = { x: S.x + ux * a + px * h, y: S.y + uy * a + py * h };
  const e2 = { x: S.x + ux * a - px * h, y: S.y + uy * a - py * h };
  const hang = (e) => e.y + sx * e.x * 0.5;
  const swing = hang(e1) > hang(e2) ? e1 : e2;

  const t = Math.max(0, Math.min(1, (d - 30) / 30));
  const E = { x: down.x + (swing.x - down.x) * t, y: down.y + (swing.y - down.y) * t };
  const c = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 };
  return `M${S.x} ${S.y} Q${c.x} ${c.y} ${E.x} ${E.y} T${W.x} ${W.y}`;
}

/**
 * The signer. One component for every use: the main stage (interactive), suggestion
 * mini-previews (compact), and Direction B playback. It only ever receives a pose
 * snapshot {E, HD, L, H, M}; the animation hook does the rest.
 *
 * Positioning is transform-only: every moving group carries exactly one CSS `transform`
 * style and no SVG `transform` attribute.
 */
export function SignerDummy({
  pose, vocab, compact = false, idle = !compact, interactive = false,
  onHandTap, onHeadTap, onDragPreview, onDragCommit,
  locationTargets = null, className = '',
}) {
  const targets = useMemo(() => computeTargets(pose, vocab), [key(pose), vocab]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [tag, setTag] = useState(null);

  const effective = useMemo(() => {
    if (!drag) return targets;
    if (drag.kind === 'hand') {
      const h = targets.hands[drag.side];
      return { ...targets, hands: { ...targets.hands, [drag.side]: { ...h, x: h.x + drag.dx, y: h.y + drag.dy, active: true, motion: null } } };
    }
    return { ...targets, head: { ...targets.head, dx: drag.dx * 0.5, dy: drag.dy * 0.35 } };
  }, [targets, drag]);

  const f = useAnimatedPose(effective, { idle });

  const toView = useCallback((e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * VIEW.w) / r.width, y: ((e.clientY - r.top) * VIEW.h) / r.height };
  }, []);

  const begin = (e, kind, side) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, side, start: toView(e), moved: false, rel: { x: 0, y: 0 } };
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
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
    if (!d.moved) { if (d.kind === 'hand') onHandTap?.(d.side); else onHeadTap?.(); }
    else onDragCommit?.(d.kind, d.side, d.rel);
  };
  const cancel = () => { dragRef.current = null; setDrag(null); setTag(null); };

  // Keyboard equivalent of drag: arrows commit a movement/head direction, Enter opens the picker.
  const ARROWS = { ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 }, ArrowLeft: { x: -30, y: 0 }, ArrowRight: { x: 30, y: 0 } };
  const keys = (kind, side) => (e) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (kind === 'hand') onHandTap?.(side); else onHeadTap?.(); }
    else if (ARROWS[e.key]) { e.preventDefault(); onDragCommit?.(kind, side, ARROWS[e.key]); }
  };

  const arm = (side) => {
    const S = SHOULDER[side], h = f[side], sx = side === 'right' ? 1 : -1;
    return armPath(S, { x: h.x, y: h.y + 11 }, sx);
  };

  const label = describePose(pose, vocab);
  const active = { right: effective.hands.right.active, left: effective.hands.left.active };

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img"
        aria-label={`Signer${label ? `: ${label}` : ' at rest'}`}
        className="block h-auto w-full select-none" style={interactive ? { touchAction: 'none' } : undefined}
      >
        {/* torso + neck */}
        <g style={{ transform: `translateY(${f.breathe}px)` }}>
          <path d="M58 302C58 214 76 150 120 146c44 4 62 68 62 156Z" fill="rgb(var(--dummy-fill))" stroke="rgb(var(--dummy-line))" strokeWidth="2" />
          <rect x="108" y="116" width="24" height="34" rx="10" fill="rgb(var(--dummy-fill))" stroke="rgb(var(--dummy-line))" strokeWidth="2" />
        </g>

        {/* arms: bezier limbs recomputed each frame from the animated hand positions */}
        {['left', 'right'].map((side) => (
          <g key={side} opacity={0.55 + 0.45 * f[side].alpha}>
            <path d={arm(side)} fill="none" stroke={active[side] ? 'rgb(var(--hand))' : 'rgb(var(--dummy-line))'} strokeWidth="13" strokeLinecap="round" />
            <path d={arm(side)} fill="none" stroke="rgb(var(--dummy-fill))" strokeWidth="10" strokeLinecap="round" />
          </g>
        ))}

        {/* head: one transform (rotation + drag nudge), features cross-fade inside */}
        <g style={{ transform: `translate(${f.head.dx}px, ${f.head.dy}px) rotate(${f.head.rot}deg)`, transformOrigin: '120px 78px', transformBox: 'view-box' }}>
          <circle cx="120" cy="78" r="46" fill="rgb(var(--dummy-fill))" stroke="rgb(var(--dummy-line))" strokeWidth="2" />
          <path d="M75 70C73 40 95 28 120 28s47 12 45 42c-12-16-30-26-45-26S87 54 75 70Z" fill="rgb(var(--dummy-line))" opacity="0.55" />
          {Object.entries(FACES).map(([family, art]) => (
            <g key={family} className="face-layer" style={{ opacity: family === effective.face ? 1 : 0 }}>{art}</g>
          ))}
          {interactive && (
            <circle
              cx="120" cy="78" r="46" fill="transparent" className="signer-hit" tabIndex={0} role="button"
              aria-label="Face and head. Tap to choose an expression; drag or use arrow keys for head movement."
              onPointerDown={(e) => begin(e, 'head', null)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
              onKeyDown={keys('head', null)}
            />
          )}
        </g>

        {/* hands */}
        {['left', 'right'].map((side) => {
          const h = f[side];
          return (
            <g key={side} style={{ transform: `translate(${h.x}px, ${h.y}px) scale(1.2)` }} opacity={h.alpha}>
              {active[side] && !compact && <circle r="21" fill="rgb(var(--hand) / 0.10)" stroke="rgb(var(--hand) / 0.4)" strokeWidth="1.2" />}
              <HandShape shape={{ curl: h.curl, spread: h.spread, thumbAngle: h.thumbAngle }} mirror={side === 'left'} active={active[side]} />
              {interactive && (
                <circle
                  r="24" fill="transparent" className="signer-hit" tabIndex={0} role="button"
                  aria-label={`${side === 'right' ? 'Right' : 'Left'} hand. Tap to choose a handshape; drag or use arrow keys for movement.`}
                  onPointerDown={(e) => begin(e, 'hand', side)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
                  onKeyDown={keys('hand', side)}
                />
              )}
            </g>
          );
        })}

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
              <circle cx={l.anchorX} cy={l.anchorY} r="11" fill="rgb(var(--location) / 0.14)" stroke="rgb(var(--location))" strokeWidth={on ? 2.4 : 1.2} strokeDasharray={on ? '' : '3 2.5'} />
              <circle className="core" cx={l.anchorX} cy={l.anchorY} r={on ? 5.5 : 4.5} fill="rgb(var(--location))" />
              {on && <text x={l.anchorX + 15} y={l.anchorY + 3.5} fontSize="9.5" fontWeight="700" fill="rgb(var(--location))" stroke="rgb(var(--surface))" strokeWidth="3" paintOrder="stroke">{l.label}</text>}
            </g>
          );
        })}
      </svg>

      {tag && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-[13px] font-semibold text-bg shadow-lift"
          style={{ left: `${(tag.x / VIEW.w) * 100}%`, top: `${(Math.max(tag.y, 40) / VIEW.h) * 100}%`, marginTop: -14 }}
        >
          {tag.text}
        </div>
      )}
    </div>
  );
}
