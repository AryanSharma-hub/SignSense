import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { config } from '../config.js';
import { hands } from '../db/seedData.js';
import { readPose, toLandmarkClip } from './poseFormat.js';
import { fetchSignPose } from './signmt.js';
// The 3D signer's rig code is shared with the client, so the server solves onto exactly the
// skeleton the browser renders.
import { AvatarRig, DRIVEN_BONES } from '../../../client/src/lib/rig3d/avatarRig.js';
import { readGltfJson, skeletonFromGltf } from '../../../client/src/lib/rig3d/gltfSkeleton.js';
import { retargetClip, buildHandLibrary, restPose, activeRange } from '../../../client/src/lib/rig3d/retarget.js';
import { FACE_SHAPES } from '../../../client/src/lib/rig3d/faceWeights.js';

/**
 * Sentence -> an animation clip for the 3D signer's rig.
 *
 * Each word or phrase is fetched as a recording of real signing (sign.mt), trimmed to the
 * part that is signed, retargeted onto the avatar (lib/rig3d/retarget.js) and cached; the
 * words are then joined with eased transitions, starting and ending at rest.
 *
 * Clip: { fps, bones: DRIVEN_BONES, faceShapes: FACE_SHAPES, encoding: 'int16-base64',
 *         frames: string[] (per frame: x,y,z,w local rotation per bone), face: string[] (weights),
 *         words: [{ text, start, end, mirrored }], source }
 */
const CLIP_VERSION = 'clip-v1';
const BLEND = 7; // frames between words
const EDGE = 8; // frames from / to rest

let shared = null;
/** The rig, the hand library (every handshape in the sign data) and the rest pose; built once. */
function rigKit() {
  if (shared) return shared;
  const rig = new AvatarRig(skeletonFromGltf(readGltfJson(fs.readFileSync(config.avatarGlb))));
  const seen = new Set();
  const shapes = hands.map((h) => h.shape).filter((s) => { const k = JSON.stringify(s); if (seen.has(k)) return false; seen.add(k); return true; });
  const lib = buildHandLibrary(rig, shapes);
  shared = { rig, lib, rest: restPose(rig) };
  return shared;
}

const clipCacheDir = () => path.join(config.dataDir, 'signing-cache');
const memory = new Map();

/** One word or phrase, retargeted: { frames: Float32Array[], face: Float32Array[], mirrored }. Cached. */
export async function clipForWord(text, deps = {}) {
  const t = String(text).trim().toLowerCase();
  const key = crypto.createHash('sha1').update(`${CLIP_VERSION}|${t}`).digest('hex');
  if (memory.has(key)) return memory.get(key);
  const file = path.join(clipCacheDir(), `${key}.json`);
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    const clip = { frames: c.frames.map((f) => Float32Array.from(f)), face: c.face.map((f) => Float32Array.from(f)), mirrored: c.mirrored };
    memory.set(key, clip);
    return clip;
  } catch { /* not cached */ }

  const bytes = await (deps.fetchSignPose ?? fetchSignPose)(t);
  const full = toLandmarkClip(readPose(bytes));
  const [a, b] = activeRange(full);
  const landmarks = { ...full, frames: full.frames.slice(a, b) };
  const { rig, lib } = rigKit();
  const r = retargetClip(rig, lib, landmarks);
  const clip = { frames: r.frames, face: r.face, mirrored: r.mirrored };
  memory.set(key, clip);
  fs.mkdirSync(clipCacheDir(), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ frames: clip.frames.map((f) => Array.from(f)), face: clip.face.map((f) => Array.from(f)), mirrored: clip.mirrored }));
  return clip;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const ease = (u) => u * u * (3 - 2 * u);
/** Frames easing from pose A to pose B (exclusive of both). */
function blend(A, B, n) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    const u = ease(k / (n + 1));
    const q = new Float32Array(A.quats.length);
    for (let i = 0; i < q.length; i += 4) {
      qa.set(A.quats[i], A.quats[i + 1], A.quats[i + 2], A.quats[i + 3]);
      qb.set(B.quats[i], B.quats[i + 1], B.quats[i + 2], B.quats[i + 3]);
      qa.slerp(qb, u);
      q.set([qa.x, qa.y, qa.z, qa.w], i);
    }
    out.push({ quats: q, face: A.face.map((v, i) => v + (B.face[i] - v) * u) });
  }
  return out;
}

/** A frame as base64 of little-endian Int16 values scaled by `scale` (quaternion parts and weights are within ±1). */
const pack = (arr, scale = 32767) => {
  const out = new Int16Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, arr[i])) * scale);
  return Buffer.from(out.buffer).toString('base64');
};

/** What to fetch for a word: a multi-digit number is signed digit by digit (as for years and phone numbers). */
const partsOf = (w) => (/^\d{2,}$/.test(w.trim()) ? [...w.trim()] : [w]);

/** A sentence (its words / phrases in signing order) as one clip. */
export async function animateWords(words, deps = {}) {
  const clips = [];
  for (const w of words) { // sequential: cache-friendly, gentle on the service
    const parts = [];
    for (const p of partsOf(w)) parts.push(await clipForWord(p, deps));
    clips.push(parts);
  }
  const { rest } = rigKit();
  const seq = [rest]; // begins exactly at rest, like the signer it replaces
  const meta = [];
  let prev = rest;
  clips.forEach((parts, i) => {
    let start = null;
    parts.forEach((c, k) => {
      const first = { quats: c.frames[0], face: c.face[0] };
      seq.push(...blend(prev, first, i === 0 && k === 0 ? EDGE : BLEND));
      start ??= seq.length;
      c.frames.forEach((q, t) => seq.push({ quats: q, face: c.face[t] }));
      prev = { quats: c.frames[c.frames.length - 1], face: c.face[c.face.length - 1] };
    });
    meta.push({ text: words[i], start, end: seq.length, mirrored: parts.some((c) => c.mirrored) });
  });
  seq.push(...blend(prev, rest, EDGE), rest);
  return {
    fps: 25,
    bones: DRIVEN_BONES,
    faceShapes: FACE_SHAPES,
    encoding: 'int16-base64', // value = int16 / 32767
    frames: seq.map((f) => pack(f.quats)),
    face: seq.map((f) => pack(f.face)),
    words: meta,
    source: 'sign.mt recordings (CC BY-NC-SA 4.0), retargeted to this avatar',
  };
}
