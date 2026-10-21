import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AvatarRig, solveTwoBone3, solveArmClear, alignFrames, REQUIRED_BONES } from '../rig3d/avatarRig.js';
import { modelX, modelY, bodyAnchor, bodyPenetration, Y_MAP } from '../rig3d/bodySpace.js';
import { fingerAngles, palmHint, FLEX_MAX } from '../rig3d/handPose.js';
import { faceWeights, FACE_SHAPES } from '../rig3d/faceWeights.js';
import { realize, handStyle, contactPart } from '../rig3d/realize.js';
import { FACE_PARAMS, faceParams } from '../rig/face.js';
import { computeTargets, motionOffset, REST } from '../pose.js';
import { mergeFull, blankStep } from '../steps.js';
import { avatarSkeleton, readGltfJson } from './avatarSkeleton.js';
import { vocab, gestures } from './helpers.js';

const V = THREE.Vector3;
const DEG = Math.PI / 180;
const json = readGltfJson();

/** The frame useAnimatedPose settles on for a pose, `t` seconds into its movement. */
function frameFor(T, t = 99) {
  const f = { breathe: 0, head: { ...T.head, turn: 0, pitch: 0 }, face: faceParams(T.face) };
  for (const side of ['right', 'left']) {
    const h = T.hands[side];
    const off = motionOffset(h.motion, t);
    f[side] = { x: h.x + off.x, y: h.y + off.y, ox: off.x, oy: off.y, curl: [...h.shape.curl], spread: h.shape.spread, thumbAngle: h.shape.thumbAngle ?? -55, alpha: h.active ? 1 : 0.4 };
  }
  return f;
}
function pose(rig, p, t) {
  const T = computeTargets(p, vocab);
  const input = realize(frameFor(T, t), T, { vocab, pose: p });
  rig.apply({ ...input, dt: 0 });
  return { T, input };
}
const step = (o) => ({ ...blankStep(), ...o });
const freshRig = () => new AvatarRig(avatarSkeleton(json));
const pos = (rig, name) => rig.modelPos(rig.bones[name]);
const palm = (rig, side) => rig.landmarks()[side].palm;
const hand = (label) => vocab.hands.find((h) => h.label === label);
const loc = (label) => vocab.locations.find((l) => l.label === label);
const sign = (gloss) => gestures.find((g) => g.gloss === gloss);
/** Every step of a sign as playback shows it: each step merged onto the previous ones. */
const stepsOf = (g) => { let acc = blankStep(); return g.signForm.map((s) => (acc = mergeFull([acc, s]))); };

describe('the avatar asset', () => {
  it('has every bone the rig drives', () => {
    const names = new Set(json.nodes.map((n) => n.name));
    expect(REQUIRED_BONES.filter((n) => !names.has(n))).toEqual([]);
  });
  it('carries the ARKit face shapes the expressions use', () => {
    const shapes = new Set(json.meshes.flatMap((m) => m.extras?.targetNames ?? []));
    expect(FACE_SHAPES.filter((n) => !shapes.has(n))).toEqual([]);
  });
});

describe('body space (where ASL locations are on the avatar)', () => {
  it('maps 2D heights landmark by landmark, top to bottom', () => {
    for (let i = 1; i < Y_MAP.length; i++) expect(modelY(Y_MAP[i][0])).toBeLessThan(modelY(Y_MAP[i - 1][0]));
  });
  it("puts the signer's right side at model -x (her anatomical right)", () => {
    expect(modelX(REST.right.x, REST.right.y)).toBeLessThan(-0.15);
    expect(modelX(REST.left.x, REST.left.y)).toBeGreaterThan(0.15);
  });
  it('places every body location on the avatar surface, ordered as on a body', () => {
    for (const l of vocab.locations.filter((x) => !['hand', 'arm', 'neutral'].includes(x.family))) {
      const a = bodyAnchor(l, 'right');
      expect(a.point.z, l.label).toBeGreaterThan(-0.01);
      expect(Math.abs(a.point.x), l.label).toBeLessThan(0.2);
    }
    const y = (label) => bodyAnchor(loc(label), 'right').point.y;
    expect(y('Forehead')).toBeGreaterThan(y('Nose'));
    expect(y('Nose')).toBeGreaterThan(y('Mouth'));
    expect(y('Mouth')).toBeGreaterThan(y('Chin'));
    expect(y('Chin')).toBeGreaterThan(y('Neck'));
    expect(y('Upper chest')).toBeGreaterThan(y('Chest'));
    expect(y('Chest')).toBeGreaterThan(y('Waist'));
  });
  it("puts side locations (cheek, shoulder, temple) on the signing hand's own side", () => {
    for (const label of ['Cheek', 'Shoulder', 'Temple', 'Ear', 'Hip']) {
      expect(bodyAnchor(loc(label), 'right').point.x, label).toBeLessThan(0);
      expect(bodyAnchor(loc(label), 'left').point.x, label).toBeGreaterThan(0);
    }
  });
  it('knows where the body is (for keeping arms out of it)', () => {
    expect(bodyPenetration(new V(0, 1.25, 0))).toBeGreaterThan(0.05); // inside the chest
    expect(bodyPenetration(new V(0, 1.25, 0.35))).toBe(0); // signing space
    expect(bodyPenetration(new V(0, 1.65, 0.03))).toBeGreaterThan(0.05); // inside the head
  });
});

describe('ASL realization: which part touches, and how', () => {
  it('classifies handshapes by their fingers', () => {
    expect(handStyle(hand('1 (index extended)').shape)).toBe('point');
    expect(handStyle(hand('S (fist)').shape)).toBe('fist');
    expect(handStyle(hand('O (circle)').shape)).toBe('bunch');
    expect(handStyle(hand('5 (open hand)').shape)).toBe('five');
    expect(handStyle(hand('Open B (relaxed palm)').shape)).toBe('flat');
  });
  it('touches with the part ASL uses', () => {
    expect(contactPart('point', 'body')).toBe('indexTip'); // I
    expect(contactPart('five', 'head')).toBe('thumbTip'); // MOTHER, FATHER
    expect(contactPart('bunch', 'head')).toBe('bunchTip'); // EAT
    expect(contactPart('flat', 'head')).toBe('middleTip'); // THANK YOU
    expect(contactPart('flat', 'body')).toBe('palm'); // PLEASE
    expect(contactPart('fist', 'hand')).toBe('fistSide'); // HELP
  });
  it('signs made in neutral space are not on the chest', () => {
    const yes = stepsOf(sign('YES'))[0];
    expect(yes.L).toBeNull();
    const T = computeTargets(yes, vocab);
    expect(T.hands.right.contact).toBeNull();
    expect(realize(frameFor(T), T, { vocab, pose: yes }).hands.right.goal.point.z).toBeGreaterThanOrEqual(0.3);
  });
  it('makes the other hand the base for signs on the hand', () => {
    const help = stepsOf(sign('HELP'))[0];
    const T = computeTargets(help, vocab);
    const r = realize(frameFor(T), T, { vocab, pose: help });
    expect(r.order).toEqual(['left', 'right']);
    expect(r.hands.right.goal.site).toBe('palm');
  });
});

describe('IK', () => {
  const S = new V(0, 0, 0);
  it('keeps bone lengths and lands on reachable targets', () => {
    const T = new V(0.2, -0.3, 0.15);
    const r = solveTwoBone3(S, T, 0.26, 0.25, new V(1, -1, 0));
    expect(r.elbow.distanceTo(S)).toBeCloseTo(0.26, 4);
    expect(r.wrist.distanceTo(r.elbow)).toBeCloseTo(0.25, 4);
    expect(r.wrist.distanceTo(T)).toBeLessThan(1e-4);
  });
  it('bends toward the pole and clamps what it cannot reach', () => {
    const T = new V(0, -0.35, 0);
    expect(solveTwoBone3(S, T, 0.26, 0.25, new V(1, 0, 0)).elbow.x).toBeGreaterThan(0);
    expect(solveTwoBone3(S, T, 0.26, 0.25, new V(-1, 0, 0)).elbow.x).toBeLessThan(0);
    const far = solveTwoBone3(S, new V(0, -2, 0), 0.26, 0.25, new V(1, 0, 0));
    expect(far.stretch).toBeGreaterThan(1);
  });
  it('chooses an elbow that keeps the arm out of the body', () => {
    // Right hand reaching across to the left side of the chest.
    const Sh = new V(-0.18, 1.4, 0.02);
    const ik = solveArmClear('right', Sh, new V(0.08, 1.3, 0.24), 0.256, 0.254);
    expect(ik.elbow.distanceTo(Sh)).toBeCloseTo(0.256, 3);
    expect(bodyPenetration(ik.elbow, 0)).toBe(0);
    expect(bodyPenetration(ik.elbow.clone().lerp(ik.wrist, 0.5), 0)).toBe(0);
  });
  it('aligns bone frames exactly', () => {
    const q = alignFrames(new V(0, 1, 0), new V(1, 0, 0), new V(0, 0, 1), new V(0, 1, 0));
    expect(new V(0, 1, 0).applyQuaternion(q).distanceTo(new V(0, 0, 1))).toBeLessThan(1e-6);
    expect(new V(1, 0, 0).applyQuaternion(q).distanceTo(new V(0, 1, 0))).toBeLessThan(1e-6);
  });
});

describe('handshapes and faces', () => {
  it('turns curls into joint angles: flat is straight, a fist is fully flexed', () => {
    expect(fingerAngles({ curl: [0, 0, 0, 0, 0], spread: 0 }).index.flex).toEqual([0, 0, 0]);
    expect(fingerAngles({ curl: [1, 1, 1, 1, 1], spread: 0 }).pinky.flex).toEqual(FLEX_MAX);
    expect(fingerAngles({ curl: [0, 0, 0, 0, 0], spread: 1 }).pinky.spread).toBeGreaterThan(0);
  });
  it('reads palm orientation hints from handshape names', () => {
    expect(palmHint('Open palm up')).toBe('up');
    expect(palmHint('Flat hands together')).toBe('together');
    expect(palmHint('V (peace)')).toBeNull();
  });
  it('shows the grammatical faces clearly', () => {
    expect(Object.values(faceWeights(FACE_PARAMS.neutral)).every((v) => v === 0)).toBe(true);
    expect(faceWeights(FACE_PARAMS.questioning).browInnerUp).toBeGreaterThan(0.5); // yes/no question
    expect(faceWeights(FACE_PARAMS.urgent).browDownLeft).toBeGreaterThan(0.4); // wh-question / concern
    expect(faceWeights(FACE_PARAMS.negative).mouthFrownLeft).toBeGreaterThan(0.3);
    expect(faceWeights(FACE_PARAMS.neutral, 1).eyeBlinkLeft).toBe(1);
  });
  it('keeps every expression natural: closed-lip smiles, a barely parted jaw, no teeth-baring shapes', () => {
    for (const [fam, p] of Object.entries(FACE_PARAMS)) {
      const w = faceWeights(p);
      for (const [name, v] of Object.entries(w)) expect(v, `${fam} ${name}`).toBeLessThanOrEqual(1);
      expect(w.mouthSmileLeft, fam).toBeLessThanOrEqual(0.5);
      expect(w.jawOpen, fam).toBeLessThanOrEqual(0.12);
      expect(w.eyeSquintLeft, fam).toBeLessThanOrEqual(0.3);
      for (const bad of ['mouthUpperUpLeft', 'mouthDimpleLeft', 'mouthFunnel', 'mouthShrugUpper', 'mouthClose']) expect(w[bad], `${fam} ${bad}`).toBeUndefined();
    }
  });
});

describe('the avatar rig (real skeleton from signer.glb)', () => {
  it('hangs both hands beside the thighs at rest', () => {
    const rig = freshRig();
    pose(rig, step({}));
    for (const side of ['right', 'left']) {
      const p = palm(rig, side);
      expect(p.y, side).toBeLessThan(1.05);
      expect(Math.abs(p.x), side).toBeGreaterThan(0.15);
      expect(Math.sign(p.x)).toBe(side === 'right' ? -1 : 1);
    }
  });

  it('lands the contact part on every body location', () => {
    const rig = freshRig();
    for (const l of vocab.locations.filter((x) => !['hand', 'arm', 'neutral'].includes(x.family) && !/AWAY$/.test(x.id))) {
      pose(rig, step({ L: l.id, H: { right: hand('1 (index extended)').id, left: null } }));
      const s = rig.solved.right;
      const c = rig.cal.right;
      const foldable = s.shoulder.distanceTo(s.target) > c.minReach + 0.12;
      if (foldable) expect(rig.handPoint('right', s.part).distanceTo(s.target), l.label).toBeLessThan(0.02);
    }
  });

  it('signs the citation forms: I, MOTHER, EAT at their places with the right part', () => {
    const rig = freshRig();
    const at = (gloss, part, label) => {
      pose(rig, stepsOf(sign(gloss))[0]);
      const a = bodyAnchor(loc(label), 'right').point;
      return rig.handPoint('right', part).distanceTo(new V(a.x, a.y, a.z));
    };
    expect(at('I', 'indexTip', 'Upper chest')).toBeLessThan(0.025);
    expect(at('MOTHER', 'thumbTip', 'Chin')).toBeLessThan(0.025);
    expect(at('EAT', 'bunchTip', 'Mouth')).toBeLessThan(0.025);
  });

  it('puts the fist on the base palm for HELP', () => {
    const rig = freshRig();
    pose(rig, stepsOf(sign('HELP'))[0]);
    const base = rig.site('left', 'palm').point;
    expect(rig.handPoint('right', 'fistSide').distanceTo(base)).toBeLessThan(0.03);
    expect(rig.site('left', 'palm').normal.y).toBeGreaterThan(0.8); // base palm faces up
  });

  it('keeps the right hand on the right and the left on the left', () => {
    const rig = freshRig();
    pose(rig, step({ H: { right: hand('Flat sweep').id, left: hand('Flat sweep').id } }));
    expect(palm(rig, 'right').x).toBeLessThan(palm(rig, 'left').x);
  });

  it('curls fingers toward the palm and straightens them flat', () => {
    const rig = freshRig();
    pose(rig, step({ H: { right: hand('Flat sweep').id, left: null } }));
    const tipOf = () => rig.handPoint('right', 'middleTip');
    const open = tipOf().distanceTo(palm(rig, 'right'));
    const a = pos(rig, 'RightHandIndex1'), b = pos(rig, 'RightHandIndex2'), c = pos(rig, 'RightHandIndex3');
    expect(b.clone().sub(a).angleTo(c.clone().sub(b))).toBeLessThan(0.2);
    pose(rig, step({ H: { right: hand('Crossed fists').id, left: null } }));
    expect(tipOf().distanceTo(palm(rig, 'right'))).toBeLessThan(open * 0.6);
  });

  it("tilts the head toward the signer's right for a positive tilt", () => {
    const rig = freshRig();
    const T = computeTargets(step({}), vocab);
    const before = rig.landmarks();
    rig.apply({ ...realize(frameFor(T), T, { vocab }), head: { roll: 0.3 }, dt: 0 });
    const after = rig.landmarks();
    expect((after.leftEye.x + after.rightEye.x) / 2).toBeLessThan((before.leftEye.x + before.rightEye.x) / 2);
  });

  it('performs every sign in the library with sound mechanics', () => {
    const rig = freshRig();
    let checked = 0;
    for (const g of gestures) {
      for (const s of stepsOf(g)) {
        for (const t of [0.2, 99]) {
          pose(rig, s, t);
          for (const side of ['right', 'left']) {
            const sol = rig.solved[side];
            const label = `${g.gloss} ${side}`;
            for (const p of [sol.elbow, sol.wrist]) expect(Number.isFinite(p.x + p.y + p.z), label).toBe(true);
            // The reference repo's backward-arm check: wrists never behind the torso.
            expect(sol.wrist.z, `${label} wrist depth`).toBeGreaterThan(-0.05);
            // Arms never pass through the body.
            expect(bodyPenetration(sol.elbow, 0), `${label} elbow inside the body`).toBeLessThan(0.015);
            expect(bodyPenetration(sol.elbow.clone().lerp(sol.wrist, 0.5), 0), `${label} forearm inside the body`).toBeLessThan(0.015);
            expect(bodyPenetration(sol.shoulder.clone().lerp(sol.elbow, 0.6), 0), `${label} upper arm inside the body`).toBeLessThan(0.015);
            // Elbows drop for signs at the face; they never flare far above the shoulder (a hand
            // on top of the head is the one place the elbow has to lift).
            expect(sol.elbow.y, `${label} elbow height`).toBeLessThan(sol.shoulder.y + (sol.target.y > 1.72 ? 0.22 : 0.12));
            // The wrist never bends beyond what a wrist can.
            const bone = rig.bones[side === 'right' ? 'RightHand' : 'LeftHand'];
            const bend = bone.quaternion.clone().multiply(rig.restLocal.get(bone).clone().invert());
            expect(2 * Math.acos(Math.min(1, Math.abs(bend.w))), `${label} wrist`).toBeLessThan(85.5 * DEG);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(gestures.length);
  }, 300000);
});
