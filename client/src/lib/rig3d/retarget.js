import * as THREE from 'three';
import { DRIVEN_BONES } from './avatarRig.js';
import { fingerAngles } from './handPose.js';
import { faceWeights, FACE_SHAPES } from './faceWeights.js';
import { surfaceZ, bodyPenetration } from './bodySpace.js';

/**
 * Retargeting recorded signing (2D landmarks: body, both hands, face — as MediaPipe Holistic
 * produces them from video, e.g. the .pose files sign.mt serves) onto the avatar's rig.
 *
 * The recordings are 2D: depth is lost. Putting 2D points straight onto a 3D skeleton is what
 * produces broken animation (arms through the body, inside-out hands, scrambled fingers), so
 * every part is LIFTED to 3D with the avatar's own anatomy and only ever posed as a valid body:
 *
 *   handedness  a clip signed by a left-handed signer is mirrored, so the avatar is always
 *               right-hand dominant;
 *   body        landmarks are expressed relative to the shoulders and scaled by shoulder
 *               width, so any signer's size maps onto the avatar;
 *   arms        depth comes from bone lengths (a foreshortened upper arm / forearm points
 *               toward the camera by exactly the missing length). The rig then solves the arm
 *               with that wrist, choosing among the anatomically possible elbows the one
 *               nearest the recorded elbow and clear of the body;
 *   hands       analysis by synthesis: the avatar's own hand, posed in each handshape of the
 *               sign library and turned through orientations, is projected and compared with
 *               the 21 recorded points. The best (handshape, orientation) per frame is chosen
 *               jointly over time (Viterbi), so the hand is always a real hand and never jumps;
 *   face        head roll / yaw / pitch from eyes, face edges and chin; mouth, brows and eyes
 *               measured against the clip's own neutral frames -> the calibrated face shapes;
 *   smoothing   positions, rotations and finger angles are low-pass filtered over time.
 *
 * Output: per frame the local rotation of every driven bone (DRIVEN_BONES) and the face
 * blend-shape weights (FACE_SHAPES) — an animation clip for this rig.
 */

const { Vector3: V, Quaternion: Q } = THREE;
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SIDES = ['right', 'left'];

/* ---------- landmark clip helpers ---------- */

/**
 * A landmark clip:
 *   { fps, frames: [{ pose: {LS,RS,LE,RE,LW,RW,LH,RH: {x,y,c}}, hands: {right, left: [21 {x,y,c}] | null},
 *                     face: {[mediapipeIndex]: {x,y}} | null }] }
 * Image coordinates (x right, y down), the signer facing the camera.
 */
const ok = (p) => p && p.c > 0 && Number.isFinite(p.x) && Number.isFinite(p.y);
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** Which hand signs: wrist travel plus time held up in signing space. */
export function dominantSide(clip) {
  const energy = { right: 0, left: 0 };
  const hipY = median(clip.frames.map((f) => (ok(f.pose.LH) && ok(f.pose.RH) ? (f.pose.LH.y + f.pose.RH.y) / 2 : NaN)));
  const shoulderY = median(clip.frames.map((f) => (ok(f.pose.LS) && ok(f.pose.RS) ? (f.pose.LS.y + f.pose.RS.y) / 2 : NaN)));
  const restY = Number.isFinite(hipY) ? hipY - 0.25 * (hipY - shoulderY) : Infinity;
  for (const [side, k] of [['right', 'RW'], ['left', 'LW']]) {
    let prev = null;
    for (const f of clip.frames) {
      const w = f.pose[k];
      if (!ok(w)) { prev = null; continue; }
      if (prev) energy[side] += Math.hypot(w.x - prev.x, w.y - prev.y);
      if (w.y < restY) energy[side] += 2; // held up in signing space
      prev = w;
    }
  }
  return energy.left > energy.right * 1.25 ? 'left' : 'right';
}

/** Mirror a clip left <-> right about the signer's midline (for left-handed recordings). */
export function mirrorClip(clip) {
  const cx = median(clip.frames.map((f) => (ok(f.pose.LS) && ok(f.pose.RS) ? (f.pose.LS.x + f.pose.RS.x) / 2 : NaN)));
  const m = (p) => (p ? { ...p, x: 2 * cx - p.x } : p);
  const SWAP = { LS: 'RS', RS: 'LS', LE: 'RE', RE: 'LE', LW: 'RW', RW: 'LW', LH: 'RH', RH: 'LH' };
  return {
    ...clip,
    frames: clip.frames.map((f) => ({
      pose: Object.fromEntries(Object.entries(f.pose).map(([k, p]) => [SWAP[k] ?? k, m(p)])),
      hands: { right: f.hands.left?.map(m) ?? null, left: f.hands.right?.map(m) ?? null },
      face: f.face ? Object.fromEntries(Object.entries(f.face).map(([k, p]) => [k, m(p)])) : null,
    })),
  };
}

/* ---------- hand library: the avatar's own hand in every handshape ---------- */

/**
 * For each handshape, the avatar hand's 21 landmarks in the hand's own frame (wrist at the
 * origin, rest orientation), so a candidate (shape, rotation) projects in microseconds.
 */
export function buildHandLibrary(rig, shapes) {
  const lib = {};
  for (const side of SIDES) {
    const hand = rig.bone(side, 'Hand');
    const inv = rig.modelQuat(hand).invert();
    lib[side] = shapes.map((shape) => {
      const angles = fingerAngles(shape);
      rig._applyFingers(side, angles);
      rig.root.updateMatrixWorld(true);
      const pts = rig.handLandmarks(side);
      const w = pts[0];
      return { shape, angles, local: pts.map((p) => p.clone().sub(w).applyQuaternion(inv)) };
    });
    rig._applyFingers(side, fingerAngles({ curl: [0.25, 0.2, 0.2, 0.22, 0.28], spread: 0.15 }));
  }
  return lib;
}

/** Deterministic, evenly spread rotations (Shoemake's method over a Halton sequence). */
function sampleRotations(n) {
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const out = [];
  for (let i = 1; i <= n; i++) {
    const u1 = halton(i, 2), u2 = halton(i, 3), u3 = halton(i, 5);
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    out.push(new Q(a * Math.sin(2 * Math.PI * u2), a * Math.cos(2 * Math.PI * u2), b * Math.sin(2 * Math.PI * u3), b * Math.cos(2 * Math.PI * u3)));
  }
  return out;
}
const ROTATIONS = sampleRotations(3000);
const PALM = [0, 1, 5, 9, 13, 17];

/**
 * 2D fit error between projected model points and observed points (both relative to their
 * wrists): best translation and a hand-size scale within 0.8–1.25, normalized by the hand's size.
 */
function fit2D(model, obs, idx) {
  let ax = 0, ay = 0, bx = 0, by = 0;
  for (const i of idx) { ax += model[i].x; ay += model[i].y; bx += obs[i].x; by += obs[i].y; }
  const n = idx.length; ax /= n; ay /= n; bx /= n; by /= n;
  let ab = 0, aa = 0, bb = 0;
  for (const i of idx) {
    const mx = model[i].x - ax, my = model[i].y - ay, ox = obs[i].x - bx, oy = obs[i].y - by;
    ab += mx * ox + my * oy; aa += mx * mx + my * my; bb += ox * ox + oy * oy;
  }
  const s = clamp(aa > 1e-12 ? ab / aa : 1, 0.8, 1.25);
  let e = 0;
  for (const i of idx) {
    const dx = s * (model[i].x - ax) - (obs[i].x - bx), dy = s * (model[i].y - ay) - (obs[i].y - by);
    e += dx * dx + dy * dy;
  }
  return e / Math.max(bb, 1e-9);
}
const project = (local, q, out) => { for (let i = 0; i < local.length; i++) out[i] = local[i].clone().applyQuaternion(q); return out; };

/** Rotate q by small turns about the three model axes (local search). */
function neighbours(q, step) {
  const out = [];
  for (const axis of [new V(1, 0, 0), new V(0, 1, 0), new V(0, 0, 1)]) {
    for (const s of [-step, step]) out.push(new Q().setFromAxisAngle(axis, s).multiply(q));
  }
  return out;
}

/**
 * Candidate (handshape, rotation) explanations of one frame's hand, best first.
 * `forearm` (model direction) penalizes wrists bent beyond what a wrist can do.
 */
export function handCandidates(lib, obs, { forearm = null, keep = 6 } = {}) {
  const neutral = lib[Math.floor(lib.length / 2)];
  const tmp = new Array(21);
  const restLocalF = new V(0, 0, 0).add(neutral.local[9]).normalize(); // wrist -> middle knuckle, hand frame
  const bendCost = (q) => {
    if (!forearm) return 0;
    const f = restLocalF.clone().applyQuaternion(q);
    return Math.max(0, f.angleTo(forearm) - 75 * DEG) * 0.6;
  };
  // 1. Orientation from the (nearly rigid) palm.
  const coarse = ROTATIONS.map((q) => ({ q, e: fit2D(project(neutral.local, q, tmp), obs, PALM) + bendCost(q) }))
    .sort((a, b) => a.e - b.e).slice(0, 14);
  // 2. Handshape and orientation together, over all 21 points.
  const all = [];
  for (const { q } of coarse) {
    for (let s = 0; s < lib.length; s++) all.push({ q, s, e: fit2D(project(lib[s].local, q, tmp), obs, ALL21) + bendCost(q) });
  }
  all.sort((a, b) => a.e - b.e);
  const picked = [];
  for (const c of all) {
    if (picked.length >= keep) break;
    if (picked.some((p) => p.s === c.s && p.q.angleTo(c.q) < 0.25)) continue;
    picked.push(c);
  }
  // 3. Refine each orientation by local search.
  for (const c of picked) {
    for (const step of [8 * DEG, 4 * DEG, 2 * DEG, 1 * DEG]) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const q of neighbours(c.q, step)) {
          const e = fit2D(project(lib[c.s].local, q, tmp), obs, ALL21) + bendCost(q);
          if (e < c.e - 1e-6) { c.q = q; c.e = e; improved = true; }
        }
      }
    }
  }
  return picked.sort((a, b) => a.e - b.e);
}
const ALL21 = Array.from({ length: 21 }, (_, i) => i);

/** Choose one candidate per frame minimizing fit error + rotation jumps + handshape changes. */
function viterbi(cands, { rotCost = 0.35, shapeCost = 0.12 } = {}) {
  const T = cands.length;
  const cost = [], back = [];
  for (let t = 0; t < T; t++) {
    const cs = cands[t];
    cost.push(cs.map(() => Infinity)); back.push(cs.map(() => -1));
    if (!cs.length) continue;
    let p = t - 1;
    while (p >= 0 && !cands[p].length) p--;
    cs.forEach((c, j) => {
      if (p < 0) { cost[t][j] = c.e; return; }
      cands[p].forEach((pc, i) => {
        const v = cost[p][i] + c.e + rotCost * pc.q.angleTo(c.q) + (pc.s === c.s ? 0 : shapeCost);
        if (v < cost[t][j]) { cost[t][j] = v; back[t][j] = i; }
      });
    });
  }
  const pick = new Array(T).fill(null);
  let t = T - 1;
  while (t >= 0 && !cands[t].length) t--;
  if (t < 0) return pick;
  let j = cost[t].indexOf(Math.min(...cost[t]));
  while (t >= 0) {
    pick[t] = cands[t][j];
    const prevJ = back[t][j];
    let p = t - 1;
    while (p >= 0 && !cands[p].length) p--;
    t = p; j = prevJ;
  }
  return pick;
}

/** Move a point forward until it is clear of the torso / head by `margin`. */
function clearOfBody(p, margin) {
  for (let i = 0; i < 12 && bodyPenetration(p, margin) > 0; i++) p.z += 0.02;
  return p;
}

/**
 * Where a hand is not tracked (it is moving into or out of view, or blurred), ease between
 * the rest hand and the nearest tracked hand over `ramp` frames instead of snapping.
 */
function rampEdges(arr, rest, ramp, lerp) {
  const tracked = arr.map((x, t) => (x ? t : -1)).filter((t) => t >= 0);
  if (!tracked.length) return arr.map(() => rest);
  return arr.map((x, t) => {
    if (x) return x;
    let near = tracked[0];
    for (const k of tracked) if (Math.abs(k - t) < Math.abs(near - t)) near = k;
    const d = Math.abs(near - t);
    const u = Math.max(0, 1 - d / ramp);
    return lerp(rest, arr[near], u * u * (3 - 2 * u));
  });
}

/** Fit error (relative to the hand's size) above which a tracked hand is treated as unseen. */
const MAX_FIT_ERROR = 0.2;

/**
 * Hand tracking flickers when the hand moves fast (into and out of a sign): a frame or two
 * of detection between gaps, often blurred. Runs shorter than `min` frames are dropped, so
 * the hand eases between reliable stretches instead of snapping to a guess.
 */
function dropIsolated(cands, min) {
  let t = 0;
  while (t < cands.length) {
    if (!cands[t].length) { t++; continue; }
    let e = t;
    while (e < cands.length && cands[e].length) e++;
    if (e - t < min) for (let k = t; k < e; k++) cands[k] = [];
    t = e;
  }
}

/* ---------- smoothing ---------- */

const gaussian = (sigma) => { const r = Math.ceil(sigma * 2.5), w = []; for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma))); return { r, w }; };
function smoothNumbers(arr, sigma) {
  const { r, w } = gaussian(sigma);
  return arr.map((_, t) => {
    let s = 0, ws = 0;
    for (let k = -r; k <= r; k++) { const v = arr[t + k]; if (Number.isFinite(v)) { s += v * w[k + r]; ws += w[k + r]; } }
    return ws ? s / ws : arr[t];
  });
}
const smoothVectors = (arr, sigma) => {
  const xs = smoothNumbers(arr.map((p) => p?.x), sigma), ys = smoothNumbers(arr.map((p) => p?.y), sigma), zs = smoothNumbers(arr.map((p) => p?.z), sigma);
  return arr.map((p, t) => (p ? new V(xs[t], ys[t], zs[t]) : p));
};
function smoothQuats(arr, sigma) {
  const { r, w } = gaussian(sigma);
  return arr.map((q, t) => {
    if (!q) return q;
    const acc = new THREE.Vector4(0, 0, 0, 0);
    for (let k = -r; k <= r; k++) {
      const o = arr[t + k];
      if (!o) continue;
      const sgn = o.dot(q) < 0 ? -1 : 1; // same hemisphere
      acc.x += o.x * sgn * w[k + r]; acc.y += o.y * sgn * w[k + r]; acc.z += o.z * sgn * w[k + r]; acc.w += o.w * sgn * w[k + r];
    }
    return new Q(acc.x, acc.y, acc.z, acc.w).normalize();
  });
}
/** No bone turns faster than this per frame (750°/s at 25 fps — beyond real signing). */
const MAX_TURN = 30 * DEG;

/** Limit how far each rotation moves from its neighbour, forward and backward, then meet halfway. */
function limitRate(track, max) {
  const fwd = track.map((q) => q.clone()), bwd = track.map((q) => q.clone());
  const step = (from, to) => (from.angleTo(to) > max ? from.clone().rotateTowards(to, max) : to);
  for (let t = 1; t < fwd.length; t++) fwd[t] = step(fwd[t - 1], fwd[t]);
  for (let t = bwd.length - 2; t >= 0; t--) bwd[t] = step(bwd[t + 1], bwd[t]);
  return fwd.map((q, t) => q.clone().slerp(bwd[t], 0.5));
}

/**
 * Final pass over every bone's rotation track: light smoothing (residual jitter), then a
 * turn-rate limit, so no single frame can whip a bone around.
 */
function smoothBoneTracks(frames, sigma) {
  const n = frames[0]?.length ?? 0;
  const out = frames.map((f) => new Float32Array(f.length));
  for (let i = 0; i < n; i += 4) {
    const track = frames.map((f) => new Q(f[i], f[i + 1], f[i + 2], f[i + 3]));
    limitRate(smoothQuats(track, sigma), MAX_TURN).forEach((q, t) => out[t].set([q.x, q.y, q.z, q.w], i));
  }
  return out;
}

/** Fill short gaps (missing frames) by interpolation; leave long gaps empty. */
function fillGaps(arr, maxGap, lerp) {
  const out = arr.slice();
  let last = -1;
  for (let t = 0; t < arr.length; t++) {
    if (arr[t] == null) continue;
    if (last >= 0 && t - last > 1 && t - last - 1 <= maxGap) {
      for (let k = last + 1; k < t; k++) out[k] = lerp(arr[last], arr[t], (k - last) / (t - last));
    }
    last = t;
  }
  return out;
}

/* ---------- the retarget ---------- */

const ARM = { right: { S: 'RS', E: 'RE', W: 'RW' }, left: { S: 'LS', E: 'LE', W: 'LW' } };
const REST_FINGERS = fingerAngles({ curl: [0.25, 0.2, 0.2, 0.22, 0.28], spread: 0.15 });

/**
 * Retarget a landmark clip onto the rig.
 * @returns {{ fps, frames: Float32Array[] (DRIVEN_BONES local quaternions), face: Float32Array[] (FACE_SHAPES),
 *             mirrored: boolean, shapes: {right, left}: (number|null)[] (library index per frame) }}
 */
export function retargetClip(rig, lib, clip, { finalPass = true } = {}) {
  const mirrored = dominantSide(clip) === 'left';
  const src = mirrored ? mirrorClip(clip) : clip;
  const F = src.frames;
  const T = F.length;

  // Body frame: shoulders -> the avatar's shoulders, scaled by shoulder width.
  const sw = median(F.map((f) => (ok(f.pose.LS) && ok(f.pose.RS) ? Math.hypot(f.pose.LS.x - f.pose.RS.x, f.pose.LS.y - f.pose.RS.y) : NaN)));
  if (!Number.isFinite(sw) || sw <= 0) throw new Error('the recording has no shoulders to scale by');
  const cal = rig.cal;
  const avS = { right: cal.right.S0, left: cal.left.S0 };
  const k = avS.left.distanceTo(avS.right) / sw;
  const centres = smoothVectors(F.map((f) => (ok(f.pose.LS) && ok(f.pose.RS) ? new V((f.pose.LS.x + f.pose.RS.x) / 2, (f.pose.LS.y + f.pose.RS.y) / 2, 0) : null)), 2);
  const midY = (avS.left.y + avS.right.y) / 2;
  const to2D = (p, t) => (ok(p) && centres[t] ? new V((p.x - centres[t].x) * k, midY - (p.y - centres[t].y) * k, 0) : null);

  // Arms: lift the wrist and elbow to 3D from bone lengths.
  const wrist = {}, elbow = {}, forearmDir = {};
  for (const side of SIDES) {
    const L1 = cal[side].L1, L2 = cal[side].L2;
    const a = ARM[side];
    const raw = F.map((f, t) => {
      const S = to2D(f.pose[a.S], t), E = to2D(f.pose[a.E], t), W = to2D(f.pose[a.W], t);
      if (!S || !E || !W) return null;
      const S3 = avS[side];
      const u = E.clone().sub(S), fo = W.clone().sub(E);
      const dzU = Math.sqrt(Math.max(0, L1 * L1 - u.lengthSq()));
      const dzF = Math.sqrt(Math.max(0, L2 * L2 - fo.lengthSq()));
      const E3 = new V(S3.x + u.x, S3.y + u.y, S3.z + dzU);
      // The forearm points toward the camera unless the hand is over the face or body and
      // that would hold it implausibly far out: then it comes back toward the body.
      const Wf = new V(E3.x + fo.x, E3.y + fo.y, E3.z + dzF), Wb = new V(E3.x + fo.x, E3.y + fo.y, E3.z - dzF);
      const front = surfaceZ(Wf.x, Wf.y);
      const W3 = front != null && Wf.z > front + 0.28 && Wb.z > front + 0.03 ? Wb : Wf;
      clearOfBody(E3, 0.05); clearOfBody(W3, 0.06);
      // The forearm between them must clear the body too (a hand resting across the belly).
      for (let i = 0; i < 12 && bodyPenetration(E3.clone().lerp(W3, 0.5), 0.045) > 0; i++) { E3.z += 0.015; W3.z += 0.015; }
      return { E3, W3 };
    });
    elbow[side] = smoothVectors(fillGaps(raw.map((r) => r?.E3 ?? null), 10, (p, q, t) => p.clone().lerp(q, t)), 1.6);
    wrist[side] = smoothVectors(fillGaps(raw.map((r) => r?.W3 ?? null), 10, (p, q, t) => p.clone().lerp(q, t)), 1.6);
    forearmDir[side] = wrist[side].map((w, t) => (w && elbow[side][t] ? w.clone().sub(elbow[side][t]).normalize() : null));
  }

  // Hands: analysis by synthesis + Viterbi over time.
  const hands = {}, shapes = {};
  for (const side of SIDES) {
    const cands = F.map((f, t) => {
      const h = f.hands[side];
      if (!h || h.filter(ok).length < 18) return [];
      const pts = h.map((p) => to2D(p, t));
      if (pts.some((p) => !p)) return [];
      const w0 = pts[0];
      const obs = pts.map((p) => p.clone().sub(w0));
      const c = handCandidates(lib[side], obs, { forearm: forearmDir[side][t] });
      return c.length && c[0].e < MAX_FIT_ERROR ? c : []; // a hand nothing explains well is treated as unseen
    });
    dropIsolated(cands, 3);
    const path = viterbi(cands);
    shapes[side] = path.map((c) => (c ? c.s : null));
    const restQ = rig.restModel.get(rig.bone(side, 'Hand')).clone();
    const filled = fillGaps(path.map((c) => c?.q ?? null), 8, (a, b, t) => a.clone().slerp(b, t));
    const q = smoothQuats(rampEdges(filled, restQ, 6, (a, b, t) => a.clone().slerp(b, t)), 1.4);
    const ang = path.map((c) => (c ? lib[side][c.s].angles : null));
    hands[side] = { q, angles: smoothAngles(rampEdges(fillGaps(ang, 8, lerpAngles), REST_FINGERS, 6, lerpAngles), 1.2), tracked: filled.map(Boolean) };
  }

  // Head and face, against the clip's own neutral (median) face.
  const face = faceTrack(F, to2D);

  // A hand that isn't tracked is resting (recorded signers hold theirs clasped at the waist):
  // it eases to the avatar's own relaxed rest, the same as the rule-based signer's.
  const restWrist = { right: new V(-0.24, 0.92, 0.05), left: new V(0.24, 0.92, 0.05) };
  // Hands held low at the midline (clasped at the waist between signs) are resting too.
  const resting = (w) => !!w && w.y < 1.04 && Math.abs(w.x) < 0.14;
  for (const side of SIDES) {
    const seen = hands[side].tracked.map((tr, t) => tr && !resting(wrist[side][t]));
    wrist[side] = rampEdges(wrist[side].map((w, t) => (seen[t] ? w : null)), restWrist[side], 6, (a, b, u) => a.clone().lerp(b, u));
    elbow[side] = elbow[side].map((e, t) => (seen[t] ? e : null));
  }

  // Pose every frame.
  const restHand = { right: rig.restModel.get(rig.bone('right', 'Hand')), left: rig.restModel.get(rig.bone('left', 'Hand')) };
  const frames = [], faces = [];
  rig.beginMotion();
  for (let t = 0; t < T; t++) {
    const arms = {};
    for (const side of SIDES) {
      const H = hands[side].q[t] ?? restHand[side].clone();
      arms[side] = {
        wrist: wrist[side][t] ?? restWrist[side].clone(),
        elbowHint: elbow[side][t] ?? null,
        H,
        fingers: hands[side].angles[t] ?? REST_FINGERS,
      };
    }
    const fw = faceWeights(face.params[t] ?? NEUTRAL_FACE, face.blink[t] ?? 0);
    rig.poseDirect({ arms, head: face.head[t] ?? {}, face: fw });
    frames.push(rig.localQuaternions());
    faces.push(Float32Array.from(FACE_SHAPES.map((n) => fw[n] ?? 0)));
  }
  rig.endMotion();
  return { fps: clip.fps, frames: finalPass ? smoothBoneTracks(frames, 1) : frames, face: faces, mirrored, shapes };
}

/** The rig at rest (hands hanging, neutral face) as a clip frame. */
export function restPose(rig) {
  const arms = {};
  for (const side of SIDES) {
    arms[side] = {
      wrist: new V(side === 'right' ? -0.24 : 0.24, 0.92, 0.05),
      elbowHint: null,
      H: rig.restModel.get(rig.bone(side, 'Hand')).clone(),
      fingers: REST_FINGERS,
    };
  }
  const fw = faceWeights(NEUTRAL_FACE, 0);
  rig.poseDirect({ arms, head: {}, face: fw });
  return { quats: rig.localQuaternions(), face: Float32Array.from(FACE_SHAPES.map((n) => fw[n] ?? 0)) };
}

/**
 * The part of a recording where something is signed: frames with a hand tracked or a wrist
 * up in signing space, plus a few frames either side. Recordings start and end at rest.
 */
export function activeRange(clip, pad = 3) {
  const F = clip.frames;
  const hipY = median(F.map((f) => (ok(f.pose.LH) && ok(f.pose.RH) ? (f.pose.LH.y + f.pose.RH.y) / 2 : NaN)));
  const shY = median(F.map((f) => (ok(f.pose.LS) && ok(f.pose.RS) ? (f.pose.LS.y + f.pose.RS.y) / 2 : NaN)));
  const restY = Number.isFinite(hipY) && Number.isFinite(shY) ? hipY - 0.2 * (hipY - shY) : Infinity;
  const active = F.map((f) => !!(f.hands.right || f.hands.left) || ['RW', 'LW'].some((k) => ok(f.pose[k]) && f.pose[k].y < restY));
  const first = active.indexOf(true), last = active.lastIndexOf(true);
  if (first < 0) return [0, F.length];
  return [Math.max(0, first - pad), Math.min(F.length, last + 1 + pad)];
}

const FINGER_KEYS = ['index', 'middle', 'ring', 'pinky'];
function lerpAngles(a, b, t) {
  const out = { thumb: { fold: a.thumb.fold + (b.thumb.fold - a.thumb.fold) * t, abduct: a.thumb.abduct + (b.thumb.abduct - a.thumb.abduct) * t, flex: a.thumb.flex.map((v, i) => v + (b.thumb.flex[i] - v) * t) } };
  for (const f of FINGER_KEYS) out[f] = { flex: a[f].flex.map((v, i) => v + (b[f].flex[i] - v) * t), spread: a[f].spread + (b[f].spread - a[f].spread) * t };
  return out;
}
function smoothAngles(arr, sigma) {
  const { r, w } = gaussian(sigma);
  return arr.map((a, t) => {
    if (!a) return a;
    let acc = null, ws = 0;
    for (let k = -r; k <= r; k++) {
      const o = arr[t + k];
      if (!o) continue;
      acc = acc ? lerpAngles(acc, o, w[k + r] / (ws + w[k + r])) : o;
      ws += w[k + r];
    }
    return acc;
  });
}

const NEUTRAL_FACE = { brow: 0, tilt: 0, eye: 1, smile: 0, open: 0, width: 1, cheek: 0 };

/** Head angles and facial parameters per frame, measured against the clip's median face. */
function faceTrack(F, to2D) {
  const get = (f, t, i) => (f.face?.[i] ? to2D({ ...f.face[i], c: 1 }, t) : null);
  const m = F.map((f, t) => {
    const P = (i) => get(f, t, i);
    const need = [33, 263, 234, 454, 10, 152, 13, 14, 61, 291, 105, 334, 159, 145, 386, 374];
    const p = Object.fromEntries(need.map((i) => [i, P(i)]));
    if (need.some((i) => !p[i])) return null;
    const faceH = p[10].distanceTo(p[152]), faceW = p[234].distanceTo(p[454]);
    const eyes = p[33].clone().add(p[263]).multiplyScalar(0.5);
    // Ordered by x (not by landmark name), so a mirrored clip measures the same way.
    const [eA, eB] = p[33].x < p[263].x ? [p[33], p[263]] : [p[263], p[33]];
    const [fA, fB] = p[234].x < p[454].x ? [p[234], p[454]] : [p[454], p[234]];
    return {
      roll: Math.atan2(eB.y - eA.y, eB.x - eA.x),
      yawR: (eyes.x - fA.x) / Math.max(1e-6, fB.x - fA.x) - 0.5,
      pitchR: (eyes.y - p[152].y) / Math.max(1e-6, p[10].y - p[152].y),
      open: p[13].distanceTo(p[14]) / faceH,
      width: p[61].distanceTo(p[291]) / faceW,
      brow: ((p[105].y - p[159].y) + (p[334].y - p[386].y)) / 2 / faceH,
      lid: (p[159].distanceTo(p[145]) + p[386].distanceTo(p[374])) / 2 / faceH,
    };
  });
  const base = {};
  for (const key of ['roll', 'yawR', 'pitchR', 'open', 'width', 'brow', 'lid']) base[key] = median(m.map((x) => x?.[key]));
  const sm = {};
  for (const key of Object.keys(base)) sm[key] = smoothNumbers(m.map((x) => x?.[key] ?? NaN), 1.5);
  const head = [], params = [], blink = [];
  for (let t = 0; t < F.length; t++) {
    if (!m[t]) { head.push(null); params.push(null); blink.push(0); continue; }
    head.push({
      roll: clamp(sm.roll[t], -0.45, 0.45),
      yaw: clamp(Math.asin(clamp(2 * (sm.yawR[t] - base.yawR), -0.9, 0.9)), -0.6, 0.6),
      pitch: clamp(-(sm.pitchR[t] - base.pitchR) * 2.5, -0.35, 0.35),
    });
    const raise = (sm.brow[t] - base.brow) / 0.03;
    params.push({
      brow: clamp(raise * 7, -3, 7), tilt: 0,
      eye: clamp(sm.lid[t] / (base.lid || 1), 0.6, 1.4),
      smile: clamp((sm.width[t] - base.width) / 0.05, -1, 1),
      open: clamp((sm.open[t] - Math.min(base.open, 0.03)) / 0.08, 0, 1),
      width: clamp(sm.width[t] / (base.width || 1), 0.7, 1.15),
      cheek: 0,
    });
    blink.push(sm.lid[t] < base.lid * 0.35 ? 1 : 0);
  }
  return { head, params, blink };
}

export { DRIVEN_BONES, FACE_SHAPES };
