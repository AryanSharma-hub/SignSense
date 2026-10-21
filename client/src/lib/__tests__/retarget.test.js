import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { AvatarRig, DRIVEN_BONES } from '../rig3d/avatarRig.js';
import { realize } from '../rig3d/realize.js';
import { retargetClip, buildHandLibrary, dominantSide, mirrorClip } from '../rig3d/retarget.js';
import { bodyPenetration } from '../rig3d/bodySpace.js';
import { computeTargets, motionOffset } from '../pose.js';
import { faceParams } from '../rig/face.js';
import { mergeFull, blankStep } from '../steps.js';
import { avatarSkeleton, readGltfJson } from './avatarSkeleton.js';
import { vocab, gestures } from './helpers.js';

const V = THREE.Vector3;
const DEG = Math.PI / 180;
const json = readGltfJson();
const freshRig = () => new AvatarRig(avatarSkeleton(json));

/**
 * A synthetic recording: the avatar performs real signs (rule-based realization), and a
 * virtual camera records its joints as 2D image landmarks — exactly what MediaPipe gives
 * from a video. Depth is thrown away. The retarget must recover the motion from 2D alone.
 */
const FPS = 25;
const toImage = (p) => ({ x: 256 + p.x * 400, y: 420 - (p.y - 1.0) * 400, c: 1 });
const FACE_REST = { // model-space rest positions of the face points the retarget reads
  33: [-0.045, 1.652, 0.12], 263: [0.045, 1.652, 0.12], 159: [-0.033, 1.659, 0.13], 145: [-0.033, 1.645, 0.13],
  386: [0.033, 1.659, 0.13], 374: [0.033, 1.645, 0.13], 105: [-0.033, 1.677, 0.135], 334: [0.033, 1.677, 0.135],
  10: [0, 1.715, 0.14], 152: [0, 1.535, 0.14], 234: [-0.075, 1.63, 0.06], 454: [0.075, 1.63, 0.06],
  13: [0, 1.592, 0.168], 14: [0, 1.58, 0.166], 61: [-0.024, 1.586, 0.15], 291: [0.024, 1.586, 0.15],
};
function record(rig, signs) {
  const head = rig.bones.Head;
  const headInv = rig.root.matrixWorld.clone().invert().multiply(head.matrixWorld).invert();
  const faceLocal = Object.fromEntries(Object.entries(FACE_REST).map(([i, p]) => [i, new V(...p).applyMatrix4(headInv)]));
  const frames = [], truth = [];
  for (const gloss of signs) {
    let acc = blankStep();
    for (const st of gestures.find((g) => g.gloss === gloss).signForm) {
      acc = mergeFull([acc, st]);
      const T = computeTargets(acc, vocab);
      for (let t = 0; t < 0.9; t += 1 / FPS) {
        const f = { breathe: 0, head: { ...T.head, turn: 0, pitch: 0 }, face: faceParams(T.face) };
        for (const side of ['right', 'left']) {
          const h = T.hands[side]; const off = motionOffset(h.motion, t);
          f[side] = { x: h.x + off.x, y: h.y + off.y, ox: off.x, oy: off.y, curl: [...h.shape.curl], spread: h.shape.spread, thumbAngle: h.shape.thumbAngle ?? -55, alpha: h.active ? 1 : 0.4 };
        }
        rig.apply({ ...realize(f, T, { vocab, pose: acc }), dt: 1 / FPS });
        const P = (n) => rig.modelPos(rig.bones[n]);
        const headM = rig.root.matrixWorld.clone().invert().multiply(head.matrixWorld);
        frames.push({
          pose: Object.fromEntries([['LS', 'LeftArm'], ['RS', 'RightArm'], ['LE', 'LeftForeArm'], ['RE', 'RightForeArm'], ['LW', 'LeftHand'], ['RW', 'RightHand'], ['LH', 'LeftUpLeg'], ['RH', 'RightUpLeg']].map(([k, n]) => [k, toImage(P(n))])),
          hands: { right: rig.handLandmarks('right').map(toImage), left: rig.handLandmarks('left').map(toImage) },
          face: Object.fromEntries(Object.entries(faceLocal).map(([i, p]) => [i, toImage(p.clone().applyMatrix4(headM))])),
        });
        truth.push(Object.fromEntries(['right', 'left'].map((s) => [s, { wrist: P(s === 'right' ? 'RightHand' : 'LeftHand'), hand: rig.handLandmarks(s) }])));
      }
    }
  }
  return { clip: { fps: FPS, frames }, truth };
}

/** Pose a rig from an animation clip frame (local quaternions of DRIVEN_BONES). */
function play(rig, quats) {
  DRIVEN_BONES.forEach((n, i) => rig.bones[n].quaternion.set(quats[i * 4], quats[i * 4 + 1], quats[i * 4 + 2], quats[i * 4 + 3]));
  rig.root.updateMatrixWorld(true);
}

let lib, recorded, result;
beforeAll(() => {
  const rig = freshRig();
  lib = buildHandLibrary(rig, vocab.hands.map((h) => h.shape));
  recorded = record(freshRig(), ['HELLO', 'THANK YOU', 'I', 'HELP', 'MOTHER']);
  result = retargetClip(rig, lib, recorded.clip);
}, 300000);

describe('retargeting recorded 2D signing onto the rig', () => {
  it('produces one rig frame per recorded frame, for every driven bone and face shape', () => {
    expect(result.frames.length).toBe(recorded.clip.frames.length);
    expect(result.frames[0].length).toBe(DRIVEN_BONES.length * 4);
    for (const f of result.frames) expect([...f].every(Number.isFinite)).toBe(true);
    expect(result.mirrored).toBe(false);
  });

  it('recovers where the hands are, from 2D alone', () => {
    const rig = freshRig();
    const err = { right: [], left: [] };
    result.frames.forEach((q, t) => {
      play(rig, q);
      for (const side of ['right', 'left']) {
        const w = rig.modelPos(rig.bones[side === 'right' ? 'RightHand' : 'LeftHand']);
        const truth = recorded.truth[t][side].wrist;
        err[side].push(Math.hypot(w.x - truth.x, w.y - truth.y)); // in the image plane
      }
    });
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    expect(mean(err.right)).toBeLessThan(0.03);
    expect(mean(err.left)).toBeLessThan(0.03);
  });

  it('recovers the handshape: fingertips relative to the wrist', () => {
    const rig = freshRig();
    const errs = [];
    result.frames.forEach((q, t) => {
      play(rig, q);
      const got = rig.handLandmarks('right'), want = recorded.truth[t].right.hand;
      for (const i of [4, 8, 12, 16, 20]) {
        const a = got[i].clone().sub(got[0]), b = want[i].clone().sub(want[0]);
        errs.push(Math.hypot(a.x - b.x, a.y - b.y)); // the part a camera sees
      }
    });
    const mean = errs.reduce((s, x) => s + x, 0) / errs.length;
    expect(mean).toBeLessThan(0.02);
  });

  it('never produces a broken body: arms out of the torso, wrists within their range', () => {
    const rig = freshRig();
    result.frames.forEach((q, t) => {
      play(rig, q);
      for (const side of ['right', 'left']) {
        const pre = side === 'right' ? 'Right' : 'Left';
        const S = rig.modelPos(rig.bones[`${pre}Arm`]), E = rig.modelPos(rig.bones[`${pre}ForeArm`]), W = rig.modelPos(rig.bones[`${pre}Hand`]);
        const at = `frame ${t} ${side}`;
        expect(bodyPenetration(E, 0), `${at} elbow`).toBeLessThan(0.015);
        expect(bodyPenetration(E.clone().lerp(W, 0.5), 0), `${at} forearm`).toBeLessThan(0.015);
        expect(bodyPenetration(S.clone().lerp(E, 0.6), 0), `${at} upper arm`).toBeLessThan(0.015);
        expect(W.z, `${at} wrist behind the body`).toBeGreaterThan(-0.05);
        const hand = rig.bones[`${pre}Hand`];
        const bend = hand.quaternion.clone().multiply(rig.restLocal.get(hand).clone().invert());
        expect(2 * Math.acos(Math.min(1, Math.abs(bend.w))), `${at} wrist bend`).toBeLessThan(85.5 * DEG);
      }
    });
  });

  it('moves smoothly: no frame-to-frame jumps in any bone', () => {
    let worst = 0;
    for (let t = 1; t < result.frames.length; t++) {
      const a = result.frames[t - 1], b = result.frames[t];
      for (let i = 0; i < DRIVEN_BONES.length; i++) {
        const dot = Math.abs(a[i * 4] * b[i * 4] + a[i * 4 + 1] * b[i * 4 + 1] + a[i * 4 + 2] * b[i * 4 + 2] + a[i * 4 + 3] * b[i * 4 + 3]);
        worst = Math.max(worst, 2 * Math.acos(Math.min(1, dot)));
      }
    }
    expect(worst).toBeLessThan(40 * DEG); // per 1/25 s
  });

  it('turns a left-handed recording into the same right-handed signing', () => {
    const left = mirrorClip(recorded.clip);
    expect(dominantSide(left)).toBe('left');
    const out = retargetClip(freshRig(), lib, left);
    expect(out.mirrored).toBe(true);
    const a = freshRig(), b = freshRig();
    const errs = [];
    out.frames.forEach((q, t) => {
      play(a, q); play(b, result.frames[t]);
      const wa = a.modelPos(a.bones.RightHand), wb = b.modelPos(b.bones.RightHand);
      errs.push(wa.distanceTo(wb));
    });
    expect(errs.reduce((s, x) => s + x, 0) / errs.length).toBeLessThan(0.02);
  }, 300000);
});
