import { PROFILE, DEPTH, LANDMARKS, TORSO, HEAD } from './avatarProfile.js';

/**
 * Body space: where a sign's 2D target (the 240x300 signer viewBox every location anchor,
 * movement and drag is authored in) sits on the 3D avatar.
 *
 * Model space is the avatar's own: metres, +y up, +z toward the viewer, the avatar's LEFT
 * at +x. The 2D figure is drawn as a mirror image (the signer's right hand on the viewer's
 * right), so the signer's right side is model -x: `modelX` is the one place that flip
 * happens. The renderer mirrors the whole avatar, so on screen the right hand is still on
 * the viewer's right, exactly like the 2D signer.
 */

/** 2D y -> model y, matched landmark by landmark (crown, forehead, eyes, nose, mouth, chin, ...). */
export const Y_MAP = [
  [30, 1.775], [52, 1.70], [60, 1.685], [75, 1.651], [80, 1.614], [96, 1.585], [114, 1.545],
  [135, 1.49], [140, 1.455], [148, 1.398], [160, 1.33], [175, 1.26], [204, 1.10], [220, 0.98],
  [250, 0.86], [300, 0.66],
];

/** Metres per 2D unit across the body (shoulder joints 44 units from the midline) and the head. */
export const K_TORSO = LANDMARKS.shoulder.x / 44;
export const K_HEAD = 0.0022;

/** Depth of the signing space in front of the chest (model z of a hand signing in neutral space). */
export const NEUTRAL_Z = 0.3;
/** Where a hand hangs at rest: beside the thigh, arm almost straight (signer's right at -x). */
export const REST_3D = { x: 0.215, y: 0.865, z: 0.05 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

export function modelY(y2d) {
  if (y2d <= Y_MAP[0][0]) return Y_MAP[0][1] + (Y_MAP[0][0] - y2d) * K_HEAD;
  for (let i = 1; i < Y_MAP.length; i++) {
    const [y0, m0] = Y_MAP[i - 1], [y1, m1] = Y_MAP[i];
    if (y2d <= y1) return lerp(m0, m1, (y2d - y0) / (y1 - y0));
  }
  const [yl, ml] = Y_MAP[Y_MAP.length - 1];
  return ml - (y2d - yl) * K_TORSO;
}

/** Horizontal scale at a 2D height: head-sized above the chin, body-sized below the neck. */
export const kAt = (y2d) => lerp(K_HEAD, K_TORSO, smooth(114, 140, y2d));

/** 2D x -> model x. The signer's right (2D x > 120) is model -x. */
export const modelX = (x2d, y2d) => -(x2d - 120) * kAt(y2d);

/** Front-most body surface z at a model (x, y), bilinear over the measured profile; null off the body. */
export function surfaceZ(x, y) {
  const fx = (x - PROFILE.X0) / PROFILE.STEP, fy = (y - PROFILE.Y0) / PROFILE.STEP;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  let sum = 0, wsum = 0;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const v = DEPTH[iy + dy]?.[ix + dx];
    if (v == null) continue;
    const w = (dx ? fx - ix : 1 - (fx - ix)) * (dy ? fy - iy : 1 - (fy - iy));
    sum += v * w; wsum += w;
  }
  return wsum > 1e-6 ? sum / wsum / 1000 : null;
}

/**
 * Body surface z near (x, y), searching toward the midline when (x, y) lies just off the
 * silhouette. Where the profile dips (the top of the shoulder, whose front belongs to the
 * excluded arm), the surface 3 cm further in wins, so a hand never sinks behind the body.
 */
function surfaceNear(x, y) {
  const inward = (px) => px - Math.sign(px) * 0.03;
  for (const r of [0, 0.02, 0.04, 0.06, 0.08]) {
    for (const [px, py] of [[x - Math.sign(x) * r, y], [x, y - r], [x, y + r]]) {
      const z = surfaceZ(px, py);
      if (z != null) return Math.max(z, (surfaceZ(inward(px), py) ?? z) - 0.02);
    }
  }
  return 0.12;
}

/**
 * Where a location's dot is drawn on the signer: its measured body point (the dominant
 * hand's side), the signing space for "Signing space", and the 2D-mapped point for places
 * on the other hand / arm (which move with that hand).
 */
export function locationDot(loc) {
  if (loc?.family === 'neutral') return { x: 0, y: 1.2, z: NEUTRAL_Z };
  if (loc?.family === 'hand' || loc?.family === 'arm') {
    const x = modelX(loc.anchorX, loc.anchorY), y = modelY(loc.anchorY);
    return { x, y, z: NEUTRAL_Z - 0.02 };
  }
  const a = bodyAnchor(loc, 'right');
  return { x: a.point.x + a.normal.x * 0.008, y: a.point.y + a.normal.y * 0.008, z: a.point.z + a.normal.z * 0.008 };
}

/* ---------- semantic body anchors (ASL locations on this avatar) ---------- */

/**
 * Every body location as a point measured on the avatar, with the direction the hand
 * approaches from (the surface normal). `side: true` locations sit on the signing hand's
 * own side (its own cheek, temple, shoulder...); the rest are on the midline. z is taken
 * from the measured surface unless given (ear, top of the head, under the chin).
 * Keys are location ids from the sign data; `bodyRegion` names are the fallback.
 */
const FRONT = { x: 0, y: 0, z: 1 };
export const BODY_ANCHORS = {
  L02: { x: 0, y: 1.70 },                                    // forehead
  L03: { x: 0, y: 1.586 },                                   // mouth
  L04: { x: 0, y: 1.548 },                                   // chin
  L05: { x: 0.052, y: 1.612, side: true },                   // cheek
  L06: { x: 0.135, y: 1.385, side: true },                   // shoulder (front)
  L07: { x: 0, y: 1.09 },                                    // waist
  L08: { x: 0, y: 1.618 },                                   // nose
  L09: { x: 0.066, y: 1.688, side: true, n: { x: 0.7, y: 0, z: 0.7 } }, // temple
  L10: { x: 0.088, y: 1.645, z: 0.035, side: true, n: { x: 1, y: 0, z: 0 } }, // ear
  L11: { x: 0, y: 1.49 },                                    // neck
  L12: { x: 0, y: 1.335 },                                    // upper chest (clavicle / top of the sternum)
  L01: { x: 0, y: 1.285 },                                    // chest
  L13: { x: 0, y: 1.205 },                                   // lower chest
  L14: { x: 0.15, y: 0.975, side: true },                    // hip
  L15: { x: 0.11, y: 0.86, side: true },                     // thigh
  LX_UNDERCHIN: { x: 0, y: 1.528, z: 0.11, n: { x: 0, y: -1, z: 0.3 } },
  LX_EYE: { x: 0.034, y: 1.655, side: true },
  LX_HEADTOP: { x: 0, y: 1.778, z: 0.02, n: { x: 0, y: 1, z: 0.2 } },
  LX_UPPERLIP: { x: 0, y: 1.6 },
  LX_HEADAWAY: { x: 0.03, y: 1.5, side: true },                // in front of the lower face (no contact)
  LX_BODYAWAY: { x: 0.04, y: 1.27, side: true },               // in front of the chest (no contact)
  LX_OTHER: { x: 0, y: 1.27 },
};
const REGION_FALLBACK = { forehead: 'L02', mouth: 'L03', chin: 'L04', cheek: 'L05', shoulder: 'L06', waist: 'L07', nose: 'L08', temple: 'L09', ear: 'L10', neck: 'L11', chest: 'L01', hip: 'L14', thigh: 'L15' };

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

/**
 * A body location for one hand, in model space: the contact point on the skin and the
 * outward surface normal there. `side` is the signing hand ('right' | 'left').
 */
export function bodyAnchor(loc, side) {
  const a = BODY_ANCHORS[loc?.id] ?? BODY_ANCHORS[REGION_FALLBACK[loc?.bodyRegion]];
  if (!a) {
    if (!loc) return null;
    const x = modelX(loc.anchorX, loc.anchorY), y = modelY(loc.anchorY);
    return { point: { x, y, z: surfaceNear(x, y) }, normal: FRONT };
  }
  const sx = a.side ? (side === 'right' ? -1 : 1) : 1; // the signer's right is model -x
  const x = a.x * sx, y = a.y;
  const z = a.z ?? surfaceNear(x, y);
  const n = a.n ? norm({ x: a.n.x * sx, y: a.n.y, z: a.n.z }) : FRONT;
  return { point: { x, y, z }, normal: n };
}

/* ---------- body volume (collision) ---------- */

/**
 * How deep a point (with a radius, e.g. a limb's thickness) is inside the torso or head,
 * in metres; 0 when clear. The torso is an elliptical cylinder through each measured slice.
 */
export function bodyPenetration(p, radius = 0) {
  let depth = 0;
  if (p.y >= TORSO[0][0] - 0.02 && p.y <= TORSO[TORSO.length - 1][0] + 0.02) {
    const yy = clamp(p.y, TORSO[0][0], TORSO[TORSO.length - 1][0]);
    let i = 1;
    while (i < TORSO.length - 1 && TORSO[i][0] < yy) i++;
    const [y0, w0, b0, f0] = TORSO[i - 1], [y1, w1, b1, f1] = TORSO[i];
    const t = (yy - y0) / (y1 - y0 || 1);
    const hw = lerp(w0, w1, t) + radius, back = lerp(b0, b1, t) - radius, front = lerp(f0, f1, t) + radius;
    const zc = (front + back) / 2, rz = (front - back) / 2;
    const d = Math.hypot(p.x / hw, (p.z - zc) / rz);
    if (d < 1) depth = Math.max(depth, (1 - d) * Math.min(hw, rz));
  }
  const hd = Math.hypot(p.x - HEAD.x, p.y - HEAD.y, p.z - HEAD.z);
  if (hd < HEAD.r + radius) depth = Math.max(depth, HEAD.r + radius - hd);
  return depth;
}
