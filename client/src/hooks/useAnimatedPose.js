import { useEffect, useRef, useState } from 'react';
import { motionOffset, headMotion, MOTION_SECONDS } from '../lib/pose.js';
import { faceParams, FACE_KEYS } from '../lib/rig/face.js';

const RATE = 12;      // exponential ease rate for anchors / finger curls (per second of sign time)
const FACE_RATE = 9;  // the face settles a touch slower than the hands, so expressions read
const SIDES = ['right', 'left'];

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const handState = (h) => ({
  x: h.x, y: h.y, curl: [...h.shape.curl], spread: h.shape.spread, thumbAngle: h.shape.thumbAngle ?? -55, alpha: h.active ? 1 : 0.4,
});
const baseState = (T) => ({
  right: handState(T.hands.right), left: handState(T.hands.left),
  head: { rot: T.head.rot, dx: T.head.dx, dy: T.head.dy },
  face: { ...faceParams(T.face) },
});

/** Frame with the movement's END position applied (used for reduced motion and first paint). */
function settledFrame(T) {
  const out = { breathe: 0, head: { rot: T.head.rot, dx: T.head.dx, dy: T.head.dy, turn: 0, pitch: 0 }, face: { ...faceParams(T.face) } };
  for (const side of SIDES) {
    const s = handState(T.hands[side]);
    const m = T.hands[side].motion;
    const off = m?.kind === 'stroke' ? motionOffset(m, 99) : { x: 0, y: 0 };
    out[side] = { ...s, x: s.x + off.x, y: s.y + off.y };
  }
  return out;
}

/**
 * Drives the signer. Each part animates independently: hand anchors and finger curls
 * ease toward their targets, every facial parameter (brows, lids, mouth) eases on its
 * own, movements (stroke / tap / shake / orbit) and head nods/shakes are layered on top
 * for a few seconds, and an idle breath keeps the figure alive.
 *
 * Time is SIGN time: `speed` scales it (0.5 = slow practice, same motion, twice as long)
 * and `paused` freezes it, so the figure holds exactly where playback was paused.
 * The loop sleeps when nothing moves (mini previews) and is skipped entirely under
 * prefers-reduced-motion. It is cancelled on unmount.
 */
export function useAnimatedPose(targets, { idle = true, speed = 1, paused = false } = {}) {
  const [frame, setFrame] = useState(() => settledFrame(targets));
  const S = useRef(null);
  if (!S.current) S.current = { cur: baseState(targets), tgt: targets, t: 0, raf: 0, last: 0, running: false, idle, speed, paused, idleT: 0 };
  Object.assign(S.current, { idle, speed, paused });

  const stepRef = useRef(null);
  stepRef.current = (now) => {
    const s = S.current;
    // A frame's timestamp can precede the time the loop was started (it is the frame's start
    // time), so elapsed time is clamped to [0, 50ms]: a negative step would make every ease
    // factor negative and fling the pose away from its target.
    const elapsed = (now - s.last) / 1000;
    const real = Number.isFinite(elapsed) ? Math.max(0, Math.min(0.05, elapsed)) : 0.016;
    s.last = now;
    const dt = s.paused ? 0 : real * s.speed;
    s.t += dt;
    s.idleT += real;
    const k = 1 - Math.exp(-dt * RATE);
    const kf = 1 - Math.exp(-dt * FACE_RATE);
    const T = s.tgt, C = s.cur, t = s.t;
    let settled = true;
    const ease = (a, b, kk = k) => { const d = b - a; if (Math.abs(d) > 0.02) settled = false; return a + d * kk; };

    for (const side of SIDES) {
      const th = T.hands[side], c = C[side];
      c.x = ease(c.x, th.x); c.y = ease(c.y, th.y);
      th.shape.curl.forEach((v, i) => { c.curl[i] = ease(c.curl[i], v); });
      c.spread = ease(c.spread, th.shape.spread);
      c.thumbAngle = ease(c.thumbAngle, th.shape.thumbAngle ?? -55);
      c.alpha = ease(c.alpha, th.active ? 1 : 0.4);
    }
    C.head.rot = ease(C.head.rot, T.head.rot); C.head.dx = ease(C.head.dx, T.head.dx); C.head.dy = ease(C.head.dy, T.head.dy);
    const fp = faceParams(T.face);
    for (const key of FACE_KEYS) C.face[key] = ease(C.face[key], fp[key], kf);

    let animating = false;
    const out = { face: { ...C.face } };
    for (const side of SIDES) {
      const m = T.hands[side].motion, c = C[side];
      if (m && t < (m.kind === 'stroke' ? 0.6 : MOTION_SECONDS)) animating = true;
      const off = motionOffset(m, t);
      const sway = s.idle && !T.hands[side].active ? Math.sin(s.idleT * 0.9 + (side === 'left' ? 1.3 : 0)) * 0.9 : 0;
      out[side] = { ...c, curl: c.curl.slice(), x: c.x + off.x, y: c.y + off.y + sway };
    }
    if (T.head.motion && t < MOTION_SECONDS) animating = true;
    const bob = s.idle ? Math.sin(s.idleT / 1.5) : 0;
    const hm = headMotion(T.head, t);
    out.head = { rot: C.head.rot + hm.rot + bob * 0.6, dx: C.head.dx, dy: C.head.dy + bob * 0.4, turn: hm.turn, pitch: hm.pitch };
    out.breathe = s.idle ? Math.sin(s.idleT * 1.6) * 0.9 : 0;
    setFrame(out);

    if (!settled || animating || s.idle || s.paused) s.raf = requestAnimationFrame((n) => stepRef.current(n));
    else s.running = false;
  };

  const start = () => {
    const s = S.current;
    if (!s.running) { s.running = true; s.last = performance.now(); s.raf = requestAnimationFrame((n) => stepRef.current(n)); }
  };

  useEffect(() => {
    const s = S.current;
    s.tgt = targets;
    s.t = 0;
    if (prefersReducedMotion()) {
      cancelAnimationFrame(s.raf); s.running = false;
      s.cur = baseState(targets);
      setFrame(settledFrame(targets));
      return;
    }
    start();
  }, [targets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resuming after a pause must restart a loop that went to sleep.
  useEffect(() => { if (!paused && !prefersReducedMotion()) start(); }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cancelAnimationFrame(S.current.raf); S.current.running = false; }, []);
  return frame;
}
