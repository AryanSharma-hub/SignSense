import * as THREE from 'three';
import { LIMITS } from '../rig/skeleton.js';
import { fingerAngles, FINGERS } from './handPose.js';
import { faceWeights } from './faceWeights.js';
import { bodyPenetration } from './bodySpace.js';
import { contactFrame } from './realize.js';

/**
 * Drives the 3D avatar's Mixamo-style skeleton from the realized sign (lib/rig3d/realize.js):
 * per hand a goal (a point, or a site on the other hand / arm), the part of the hand that
 * must arrive there, a palm frame, the handshape and the movement; plus head and face.
 *
 * Everything is solved in MODEL space (the avatar's own: metres, +y up, +z toward the
 * viewer, the avatar's left at +x), relative to the measured rest pose, so nothing depends
 * on how the exporter rolled each bone.
 *
 *   - the base hand (for signs made on the other hand / arm) is solved first;
 *   - arms: analytic two-bone IK; of all the elbow positions that reach the wrist, the one
 *     chosen keeps the upper arm, elbow and forearm OUT of the torso and head and the elbow
 *     low, so arms never pass through or behind the body;
 *   - the contact part lands on the goal: the arm is solved, the offset from the wrist to the
 *     contact part (index tip, thumb tip, palm, fist side...) is measured by forward
 *     kinematics, and the arm is solved again for that offset;
 *   - a free hand that would clip the body is moved forward until it clears it;
 *   - palm orientation and the goal ease over time; the forearm takes part of the twist;
 *   - fingers flex about their own measured axes, straight at curl 0.
 */

const { Vector3: V, Quaternion: Q, Matrix4: M } = THREE;
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vec = (o) => new V(o.x, o.y, o.z);

export const SIDE_PREFIX = { right: 'Right', left: 'Left' };
const DIGIT = { index: 'Index', middle: 'Middle', ring: 'Ring', pinky: 'Pinky' };
/** The bones an animation clip drives (spine, neck, head, eyes, both arms, every finger joint). */
export const DRIVEN_BONES = [
  'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye',
  ...['Right', 'Left'].flatMap((s) => [
    `${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`,
    ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((d) => [1, 2, 3].map((k) => `${s}Hand${d}${k}`)),
  ]),
];

export const REQUIRED_BONES = [
  'Hips', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye',
  ...['Left', 'Right'].flatMap((s) => [
    `${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`,
    ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((d) => [1, 2, 3].map((k) => `${s}Hand${d}${k}`)),
  ]),
];

const WRIST_MAX = 85 * DEG;
const FOREARM_TWIST = 0.55;
const RATE = 10;
/** Limb radii used to keep arms clear of the body (upper arm, forearm, hand). */
const LIMB = { upper: 0.036, fore: 0.03, hand: 0.018 };

/** Analytic two-bone IK in 3D. Same contract as lib/rig/ik.js solveTwoBone, plus the bend normal. */
export function solveTwoBone3(S, T, L1, L2, pole, minElbowDeg = LIMITS.elbowMinDeg) {
  const d = new V().subVectors(T, S);
  let len = d.length();
  const u = len > 1e-6 ? d.clone().divideScalar(len) : new V(0, -1, 0);
  if (len <= 1e-6) len = 1e-6;
  const max = L1 + L2 - 0.0005;
  const min = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(minElbowDeg * DEG));
  const reach = clamp(len, min, max);
  const a = (L1 * L1 - L2 * L2 + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u)));
  if (p.lengthSq() < 1e-10) p.set(1, 0, 0).sub(u.clone().multiplyScalar(u.x));
  p.normalize();
  return {
    elbow: S.clone().addScaledVector(u, a).addScaledVector(p, h),
    wrist: S.clone().addScaledVector(u, reach),
    normal: new V().crossVectors(p, u).normalize(),
    stretch: len - reach,
    circle: { center: S.clone().addScaledVector(u, a), radius: h, u, p },
  };
}

/**
 * Which way the elbow prefers to fold. Low hands: back, down and a little out (a relaxed
 * arm). As the hand rises toward the face the elbow drops and comes forward.
 */
export function elbowPole(side, S, wrist) {
  const out = side === 'right' ? -1 : 1;
  const high = clamp((wrist.y - (S.y - 0.15)) / 0.3, 0, 1);
  return new V(out * (0.55 - 0.15 * high), -0.55 - 0.65 * high, -0.45 + 0.9 * high).normalize();
}

/**
 * Arm IK that picks, among all elbow positions reaching the wrist, one that keeps the arm
 * clear of the body and lets the wrist reach the hand's direction (`handDir`, the fingers'
 * direction) without bending past what a wrist comfortably can.
 */
export function solveArmClear(side, S, W, L1, L2, handDir = null, elbowHint = null, prevElbow = null) {
  const ik = solveTwoBone3(S, W, L1, L2, elbowPole(side, S, W));
  const { center, radius, u, p } = ik.circle;
  if (radius < 1e-4) return ik;
  const q = new V().crossVectors(u, p);
  const score = (E, theta) => {
    const mid1 = S.clone().lerp(E, 0.5), mid2 = E.clone().lerp(ik.wrist, 0.5);
    const pen = bodyPenetration(E, LIMB.upper) + bodyPenetration(mid1, LIMB.upper) + bodyPenetration(mid2, LIMB.fore) * 1.5;
    const lift = Math.max(0, E.y - S.y - 0.04);
    const flare = Math.max(0, Math.abs(E.x) - Math.abs(S.x) - 0.1); // elbow winging out sideways
    const bend = handDir ? Math.max(0, new V().subVectors(ik.wrist, E).angleTo(handDir) - 60 * DEG) : 0;
    // A recorded elbow (motion data) pulls the choice toward where the signer's elbow really was.
    const follow = elbowHint ? E.distanceToSquared(elbowHint) * 40 : 0;
    // In an animation the elbow keeps moving the way it was: no hopping between solutions.
    const keep = prevElbow ? E.distanceToSquared(prevElbow) * 120 : 0;
    return pen * 150 + lift * 10 + flare * 3 + bend * 1.5 + follow + keep + theta * theta * 0.03;
  };
  let best = { theta: 0, E: ik.elbow, s: score(ik.elbow, 0) };
  if (best.s > 1e-6 || elbowHint || prevElbow) {
    for (let k = -24; k <= 24; k++) {
      if (!k) continue;
      const theta = k * 7.5 * DEG;
      const dir = p.clone().multiplyScalar(Math.cos(theta)).addScaledVector(q, Math.sin(theta));
      const E = center.clone().addScaledVector(dir, radius);
      const s = score(E, theta);
      if (s < best.s) best = { theta, E, s, dir };
    }
  }
  if (best.theta === 0) return ik;
  return { ...ik, elbow: best.E, normal: new V().crossVectors(best.dir, u).normalize() };
}

const _m0 = new M(), _m1 = new M();
function basis(a, b, m) {
  const x = a.clone().normalize();
  const y = b.clone().addScaledVector(x, -b.dot(x)).normalize();
  return m.makeBasis(x, y, new V().crossVectors(x, y));
}
/** Rotation taking the frame (a0, b0) onto (a1, b1): a0 -> a1 exactly, b0 as close to b1 as it can. */
export function alignFrames(a0, b0, a1, b1, out = new Q()) {
  basis(a0, b0, _m0).transpose();
  basis(a1, b1, _m1).multiply(_m0);
  return out.setFromRotationMatrix(_m1);
}

const angleAbout = (u, v, axis) => Math.atan2(new V().crossVectors(u, v).dot(axis), u.dot(v));

export class AvatarRig {
  /** @param {THREE.Object3D} root the avatar's own root (model space); bones are found by name. */
  constructor(root) {
    this.root = root;
    this.bones = {};
    root.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    const missing = REQUIRED_BONES.filter((n) => !this.bones[n]);
    if (missing.length) throw new Error(`The avatar rig is missing bones: ${missing.join(', ')}`);
    this.meshes = [];
    root.traverse((o) => { if (o.isMesh && o.morphTargetDictionary) this.meshes.push(o); });

    root.updateMatrixWorld(true);
    this.restLocal = new Map();
    this.restModel = new Map();
    for (const b of Object.values(this.bones)) {
      this.restLocal.set(b, b.quaternion.clone());
      this.restModel.set(b, this.modelQuat(b));
    }
    this.cal = { right: this._calibrateSide('right'), left: this._calibrateSide('left') };
    this._calibrateHead();
    this.state = { hand: { right: null, left: null }, goal: { right: null, left: null } };
    this.solved = { right: null, left: null };
  }

  modelQuat(bone, out = new Q()) {
    out.copy(bone.quaternion);
    for (let p = bone.parent; p && p !== this.root; p = p.parent) out.premultiply(p.quaternion);
    return out;
  }
  modelPos(bone, out = new V()) {
    bone.getWorldPosition(out);
    return this.root.worldToLocal(out);
  }
  bone(side, name) { return this.bones[SIDE_PREFIX[side] + name]; }
  _localAxis(bone, axis) { return axis.clone().applyQuaternion(this.restModel.get(bone).clone().invert()).normalize(); }

  _calibrateSide(side) {
    const b = (n) => this.bone(side, n);
    const pos = (n) => this.modelPos(b(n));
    const S0 = pos('Arm'), E0 = pos('ForeArm'), W0 = pos('Hand');
    const M1 = pos('HandMiddle1'), M3 = pos('HandMiddle3'), I1 = pos('HandIndex1'), K1 = pos('HandPinky1');
    const f0 = new V().subVectors(M1, W0).normalize();
    const across = new V().subVectors(I1, K1).normalize();
    const p0 = new V().crossVectors(f0, across).normalize();
    const curl = new V().subVectors(M3, M1);
    if (curl.addScaledVector(f0, -curl.dot(f0)).dot(p0) < 0) p0.negate();

    const fingers = {};
    for (const name of FINGERS) {
      const joints = [1, 2, 3].map((k) => b(`Hand${DIGIT[name]}${k}`));
      const pts = [W0, ...joints.map((j) => this.modelPos(j))];
      pts.push(pts[3].clone().add(new V().subVectors(pts[3], pts[2]).multiplyScalar(0.85)));
      const segs = [0, 1, 2, 3].map((i) => new V().subVectors(pts[i + 1], pts[i]).normalize());
      const axis = new V().crossVectors(segs[1], p0).normalize();
      const fan = name === 'index' || name === 'middle' ? across : across.clone().negate();
      const spreadSign = Math.sign(new V().crossVectors(p0, segs[1]).dot(fan)) || 1;
      fingers[name] = {
        joints,
        flexAxis: joints.map((j) => this._localAxis(j, axis)),
        restFlex: [0, 1, 2].map((k) => angleAbout(segs[k], segs[k + 1], axis)),
        spreadAxis: this._localAxis(joints[0], p0),
        spreadSign,
      };
    }

    const thumb = [1, 2, 3].map((k) => b(`HandThumb${k}`));
    const T = thumb.map((j) => this.modelPos(j));
    const tDir = new V().subVectors(T[1], T[0]).normalize();
    const toward = new V().subVectors(K1, T[0]).normalize().addScaledVector(p0, 0.8).normalize();
    const foldAxis = new V().crossVectors(tDir, toward).normalize();
    const abductAxis = new V().crossVectors(tDir, f0).normalize();
    const flexAxis = new V().crossVectors(new V().subVectors(T[2], T[1]).normalize(), p0).normalize();

    const L1 = S0.distanceTo(E0), L2 = E0.distanceTo(W0);
    return {
      S0, E0, W0, L1, L2,
      minReach: 1.04 * Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(LIMITS.elbowMinDeg * DEG)),
      upper0: new V().subVectors(E0, S0).normalize(),
      fore0: new V().subVectors(W0, E0).normalize(),
      n0: new V().crossVectors(new V().subVectors(E0, S0), new V().subVectors(W0, E0)).normalize(),
      f0, p0, across0: across,
      palmOffset: M1.distanceTo(W0) * 0.5,
      twistAxis: b('Hand').position.clone().normalize(),
      fingers,
      thumb: {
        joints: thumb,
        fold: this._localAxis(thumb[0], foldAxis),
        abduct: this._localAxis(thumb[0], abductAxis),
        flex: thumb.map((j) => this._localAxis(j, flexAxis)),
      },
      clavicleAxis: this._localAxis(b('Shoulder'), new V(0, 0, side === 'left' ? 1 : -1)),
    };
  }

  _calibrateHead() {
    const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
    this.headAxes = {};
    for (const n of ['Neck', 'Head']) {
      const bn = this.bones[n];
      this.headAxes[n] = { x: this._localAxis(bn, X), y: this._localAxis(bn, Y), z: this._localAxis(bn, Z) };
    }
    this.chestAxis = this._localAxis(this.bones.Spine2, X);
  }

  _rotateLocal(bone, ...turns) {
    const q = bone.quaternion.copy(this.restLocal.get(bone));
    for (const [axis, angle] of turns) if (angle) q.multiply(new Q().setFromAxisAngle(axis, angle));
  }

  /** The hand's current palm frame in model space. */
  _handFrame(side) {
    const c = this.cal[side];
    const hand = this.bone(side, 'Hand');
    const d = this.modelQuat(hand).multiply(this.restModel.get(hand).clone().invert());
    return { f: c.f0.clone().applyQuaternion(d), p: c.p0.clone().applyQuaternion(d), across: c.across0.clone().applyQuaternion(d) };
  }

  /** Model-space position of a part of a hand (after posing). */
  handPoint(side, part) {
    const pos = (n) => this.modelPos(this.bone(side, n));
    const tip = (d) => { const a = pos(`Hand${d}2`), b = pos(`Hand${d}3`); return b.clone().add(b.clone().sub(a).multiplyScalar(0.85)); };
    const thumbTip = () => { const a = pos('HandThumb2'), b = pos('HandThumb3'); return b.clone().add(b.clone().sub(a).multiplyScalar(0.9)); };
    const centre = () => pos('Hand').lerp(pos('HandMiddle1'), 0.55);
    switch (part) {
      case 'indexTip': return tip('Index');
      case 'middleTip': return tip('Middle');
      case 'ringTip': return tip('Ring');
      case 'pinkyTip': return tip('Pinky');
      case 'thumbTip': return thumbTip();
      case 'bunchTip': return tip('Index').add(tip('Middle')).add(thumbTip()).multiplyScalar(1 / 3);
      case 'knuckles': return pos('HandMiddle2');
      case 'fistSide': return pos('HandPinky1').lerp(pos('HandPinky2'), 0.5).addScaledVector(this._handFrame(side).across, -0.012);
      case 'palm': return centre().addScaledVector(this._handFrame(side).p, 0.014);
      default: return centre();
    }
  }

  /** A contact site on a (posed) base hand / arm: point and outward normal, model space. */
  site(side, name) {
    const pos = (n) => this.modelPos(this.bone(side, n));
    const { f, p, across } = this._handFrame(side);
    const centre = pos('Hand').lerp(pos('HandMiddle1'), 0.55);
    const S = pos('Arm'), E = pos('ForeArm'), W = pos('Hand');
    const fore = W.clone().sub(E).normalize();
    const mid = E.clone().lerp(W, 0.55);
    const up = new V(0, 1, 0);
    const at = (point, normal) => ({ point, normal: normal.clone().normalize() });
    switch (name) {
      case 'back': return at(centre.clone().addScaledVector(p, -0.024), p.clone().negate());
      case 'handNear': return at(centre.clone().addScaledVector(p, 0.014), p);
      case 'fingertip': return at(this.handPoint(side, 'middleTip'), f);
      case 'fingerFront': return at(pos('HandMiddle2').addScaledVector(p, 0.01), p);
      case 'fingerBack': return at(pos('HandMiddle2').addScaledVector(p, -0.012), p.clone().negate());
      case 'fingerRadial': return at(pos('HandIndex2').addScaledVector(across, 0.01), across);
      case 'fingerUlnar': return at(pos('HandPinky2').addScaledVector(across, -0.01), across.clone().negate());
      case 'heel': return at(pos('Hand').lerp(pos('HandMiddle1'), 0.2).addScaledVector(p, 0.012), p);
      case 'forearmFront': return at(mid.clone().addScaledVector(p, 0.028), p);
      case 'forearmBack': return at(mid.clone().addScaledVector(p, -0.03), p.clone().negate());
      case 'forearmUlnar': return at(mid.clone().addScaledVector(across, -0.03), across.clone().negate());
      case 'wristFront': return at(E.clone().lerp(W, 0.92).addScaledVector(p, 0.024), p);
      case 'wristBack': return at(E.clone().lerp(W, 0.92).addScaledVector(p, -0.026), p.clone().negate());
      case 'elbow': return at(E.clone().addScaledVector(fore, -0.02).add(new V(0, -0.03, 0)), new V(0, -1, 0)); // touched from below
      case 'upperArm': { const front = new V(0, 0, 1); return at(S.clone().lerp(E, 0.55).addScaledVector(front, 0.045), front); } // front of the (raised) upper arm
      case 'armNear': return at(mid.clone().addScaledVector(up, 0.05), up);
      default: return at(centre.clone().addScaledVector(p, 0.014), p); // palm
    }
  }

  /**
   * Pose the avatar.
   * @param {object} input  realize() output: { hands, head, face, breathe, order }
   *   plus blink (0..1), gaze (model-space point) and dt (seconds; 0 snaps the easing).
   * @returns {boolean} true when the eased parts have settled
   */
  apply({ hands, head = {}, face, blink = 0, breathe = 0, gaze = null, dt = 0, order = ['right', 'left'] }) {
    const k = dt > 0 ? 1 - Math.exp(-dt * RATE) : 1;
    let settled = true;

    this._rotateLocal(this.bones.Spine2, [this.chestAxis, -breathe * 0.012]);
    const share = (n, f) => [[this.headAxes[n].z, (head.roll || 0) * f], [this.headAxes[n].x, (head.pitch || 0) * f], [this.headAxes[n].y, (head.yaw || 0) * f]];
    this._rotateLocal(this.bones.Neck, ...share('Neck', 0.4));
    this._rotateLocal(this.bones.Head, ...share('Head', 0.6));
    this.root.updateMatrixWorld(true);

    for (const side of order) {
      const h = hands[side];
      const c = this.cal[side];
      const w = clamp(h.w ?? 1, 0, 1);
      const other = side === 'right' ? 'left' : 'right';

      // Goal and palm frame (a site on the other hand / arm is read off its solved pose).
      let goal, frame = h.frame;
      if (h.goal.site) {
        const s = this.site(other, h.goal.site);
        goal = s.point.clone().addScaledVector(s.normal, h.goal.gap ?? 0.006);
        frame = contactFrame(h.style, h.goal.on, side, s.normal);
      } else goal = vec(h.goal.point);
      goal.lerp(vec(h.restPoint), 1 - w);

      // Ease the anchor (between signs); the movement rides on top un-eased.
      const g = this.state.goal[side];
      if (!g || k >= 1) this.state.goal[side] = goal.clone();
      else {
        if (g.distanceTo(goal) > 0.002) settled = false;
        g.lerp(goal, k);
      }
      const P = this.state.goal[side].clone().add(vec(h.motion || { x: 0, y: 0, z: 0 }));

      // Palm orientation, eased; blended from the hanging hand by w.
      const handRest = this.restModel.get(this.bone(side, 'Hand'));
      const qAct = alignFrames(c.f0, c.p0, vec(frame.f), vec(frame.p)).multiply(handRest);
      const qRest = alignFrames(c.f0, c.p0, vec(h.restFrame.f), vec(h.restFrame.p)).multiply(handRest);
      const want = qRest.clone().slerp(qAct, w);
      const cur = this.state.hand[side];
      if (!cur || k >= 1) this.state.hand[side] = want.clone();
      else {
        if (cur.angleTo(want) > 0.01) settled = false;
        cur.slerp(want, k);
      }
      const H = this.state.hand[side];

      // Shoulders rise a little when the hand works above them.
      this._rotateLocal(this.bone(side, 'Shoulder'), [c.clavicleAxis, clamp((P.y - (c.S0.y - 0.04)) / 0.3, 0, 1) * 9 * DEG * w]);
      this.root.updateMatrixWorld(true);
      const S = this.modelPos(this.bone(side, 'Arm'));

      // Solve, measure where the contact part landed, and correct until it lands on the goal.
      const part = h.part || 'center';
      let wristGoal = P.clone().addScaledVector(c.f0.clone().applyQuaternion(H.clone().multiply(handRest.clone().invert())), -c.palmOffset);
      let sol = this._solveSide(side, S, wristGoal, H, h.shape);
      // Correct by the measured miss each pass: converges even when the elbow choice or the
      // wrist limit changes the hand's exact pose between passes.
      for (let pass = 0; pass < 6; pass++) {
        const miss = P.clone().sub(this.handPoint(side, part));
        if (miss.length() < 0.003) break;
        wristGoal.add(miss);
        sol = this._solveSide(side, S, wristGoal, H, h.shape);
      }
      // A hand signing in space must not clip the body: move it forward until it clears.
      if (!h.contact && w > 0.3) {
        const probe = ['center', 'indexTip', 'middleTip', 'thumbTip'].map((n) => bodyPenetration(this.handPoint(side, n), LIMB.hand));
        const depth = Math.max(...probe);
        if (depth > 0.002) {
          wristGoal.z += depth + 0.02;
          sol = this._solveSide(side, S, wristGoal, H, h.shape);
        }
      }
      this.solved[side] = { shoulder: S, elbow: sol.elbow, wrist: sol.wrist, target: P, stretch: sol.stretch, part };
    }

    this.root.updateMatrixWorld(true);
    if (gaze) this._gaze(gaze);
    if (face) this._face(faceWeights(face, blink));
    return settled;
  }

  /**
   * IK for one arm toward a wrist goal, with the hand held at model rotation H. `fingers` is
   * a handshape ({curl, spread, thumbAngle}) or finger angles (handPose.fingerAngles form).
   */
  _solveSide(side, S, wristGoal, H, fingers, elbowHint = null, prevElbow = null) {
    const c = this.cal[side];
    const goal = wristGoal.clone();
    const near = new V().subVectors(goal, S);
    if (near.length() < c.minReach) goal.z = S.z + Math.sqrt(Math.max(0, c.minReach * c.minReach - near.x * near.x - near.y * near.y));
    const handDir = c.f0.clone().applyQuaternion(H.clone().multiply(this.restModel.get(this.bone(side, 'Hand')).clone().invert()));
    const ik = solveArmClear(side, S, goal, c.L1, c.L2, handDir, elbowHint, prevElbow);

    const arm = this.bone(side, 'Arm'), fore = this.bone(side, 'ForeArm'), hand = this.bone(side, 'Hand');
    const qUpper = alignFrames(c.upper0, c.n0, new V().subVectors(ik.elbow, S), ik.normal).multiply(this.restModel.get(arm));
    arm.quaternion.copy(this.modelQuat(arm.parent).invert().multiply(qUpper));
    const qFore = alignFrames(c.fore0, c.n0, new V().subVectors(ik.wrist, ik.elbow), ik.normal).multiply(this.restModel.get(fore));

    const restRel = this.restLocal.get(hand);
    const change = qFore.clone().invert().multiply(H).multiply(restRel.clone().invert());
    const ax = c.twistAxis;
    const proj = change.x * ax.x + change.y * ax.y + change.z * ax.z;
    // Signed twist about the forearm. In an animation it is unwrapped to stay nearest the
    // previous frame's, so it never flips by a half turn when the hand rolls past 180°.
    let twist = change.w < 0 ? 2 * Math.atan2(-proj, -change.w) : 2 * Math.atan2(proj, change.w); // in (-180°, 180°]
    const prevTwist = this.motion?.twist?.[side];
    if (prevTwist != null) twist += 2 * Math.PI * Math.round((prevTwist - twist) / (2 * Math.PI));
    if (this.motion) (this.motion.twist ||= {})[side] = twist;
    // The forearm takes its share, within the range a forearm can roll.
    const roll = clamp(twist * FOREARM_TWIST, -100 * DEG, 100 * DEG);
    const qFore2 = qFore.clone().multiply(new Q().setFromAxisAngle(ax, roll));
    fore.quaternion.copy(qUpper.clone().invert().multiply(qFore2));

    const local = qFore2.clone().invert().multiply(H);
    const bend = local.clone().multiply(restRel.clone().invert());
    const angle = 2 * Math.acos(clamp(Math.abs(bend.w), 0, 1));
    if (angle > WRIST_MAX) local.copy(new Q().slerp(bend, WRIST_MAX / angle).multiply(restRel));
    hand.quaternion.copy(local);
    this._applyFingers(side, fingers?.index ? fingers : fingerAngles(fingers));
    this.root.updateMatrixWorld(true);
    return ik;
  }

  _applyFingers(side, a) {
    const c = this.cal[side];
    for (const name of FINGERS) {
      const F = c.fingers[name], A = a[name];
      F.joints.forEach((j, k) => {
        const turns = [[F.flexAxis[k], A.flex[k] - F.restFlex[k]]];
        if (k === 0) turns.unshift([F.spreadAxis, A.spread * F.spreadSign]);
        this._rotateLocal(j, ...turns);
      });
    }
    const T = c.thumb, t = a.thumb;
    this._rotateLocal(T.joints[0], [T.abduct, t.abduct], [T.fold, t.fold]);
    this._rotateLocal(T.joints[1], [T.flex[1], t.flex[1]]);
    this._rotateLocal(T.joints[2], [T.flex[2], t.flex[2]]);
  }

  _gaze(point) {
    for (const n of ['LeftEye', 'RightEye']) {
      const eye = this.bones[n];
      const dir = point.clone().sub(this.modelPos(eye)).normalize();
      const fwd = new V(0, 0, 1);
      const ang = fwd.angleTo(dir);
      const limited = ang > 20 * DEG ? fwd.clone().lerp(dir, (20 * DEG) / ang).normalize() : dir;
      const q = new Q().setFromUnitVectors(fwd, limited).multiply(this.restModel.get(eye));
      eye.quaternion.copy(this.modelQuat(eye.parent).invert().multiply(q));
    }
  }

  _face(weights) {
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
      for (const [name, v] of Object.entries(weights)) {
        const i = dict[name];
        if (i !== undefined) inf[i] = v;
      }
    }
  }

  /**
   * Pose the avatar directly from motion data (lib/rig3d/retarget.js): per arm a wrist
   * position, an optional recorded elbow position (a hint, never forced), the hand's model
   * rotation and its finger angles; plus head angles and face blend-shape weights. The same
   * anatomy rules as apply() hold: the arm chosen stays clear of the body, the wrist bends
   * no further than a wrist can, and a hand that would clip the body is brought forward.
   */
  poseDirect({ arms, head = {}, face = null, gaze = null }) {
    this._rotateLocal(this.bones.Spine2);
    const share = (n, f) => [[this.headAxes[n].z, (head.roll || 0) * f], [this.headAxes[n].x, (head.pitch || 0) * f], [this.headAxes[n].y, (head.yaw || 0) * f]];
    this._rotateLocal(this.bones.Neck, ...share('Neck', 0.4));
    this._rotateLocal(this.bones.Head, ...share('Head', 0.6));
    this.root.updateMatrixWorld(true);
    for (const side of ['right', 'left']) {
      const a = arms[side];
      const c = this.cal[side];
      this._rotateLocal(this.bone(side, 'Shoulder'), [c.clavicleAxis, clamp((a.wrist.y - (c.S0.y - 0.04)) / 0.3, 0, 1) * 9 * DEG]);
      this.root.updateMatrixWorld(true);
      const S = this.modelPos(this.bone(side, 'Arm'));
      const goal = a.wrist.clone();
      const prev = this.motion?.[side] ?? null;
      let sol = this._solveSide(side, S, goal, a.H, a.fingers, a.elbowHint, prev);
      const depth = Math.max(...['center', 'indexTip', 'middleTip', 'thumbTip', 'pinkyTip'].map((n) => bodyPenetration(this.handPoint(side, n), LIMB.hand)));
      if (depth > 0.002) {
        goal.z += depth + 0.012;
        sol = this._solveSide(side, S, goal, a.H, a.fingers, a.elbowHint, prev);
      }
      if (this.motion) this.motion[side] = sol.elbow.clone();
      this.solved[side] = { shoulder: S, elbow: sol.elbow, wrist: sol.wrist, target: goal, stretch: sol.stretch, part: 'center' };
    }
    this.root.updateMatrixWorld(true);
    if (gaze) this._gaze(gaze);
    if (face) this._face(face);
  }

  /** Start (or stop) treating successive poseDirect() calls as one continuous animation. */
  beginMotion() { this.motion = { right: null, left: null }; }
  endMotion() { this.motion = null; }

  /** The hand's 21 landmarks in MediaPipe order (model space): wrist, then thumb, index, middle, ring, pinky. */
  handLandmarks(side) {
    const pos = (n) => this.modelPos(this.bone(side, n));
    const out = [pos('Hand')];
    for (const d of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      out.push(pos(`Hand${d}1`), pos(`Hand${d}2`), pos(`Hand${d}3`));
      out.push(d === 'Thumb' ? this.handPoint(side, 'thumbTip') : this.handPoint(side, `${d.toLowerCase()}Tip`));
    }
    return out;
  }

  /** Local rotations of the driven bones (DRIVEN_BONES order), as x,y,z,w per bone. */
  localQuaternions(out = new Float32Array(DRIVEN_BONES.length * 4)) {
    DRIVEN_BONES.forEach((n, i) => { const q = this.bones[n].quaternion; out.set([q.x, q.y, q.z, q.w], i * 4); });
    return out;
  }

  /** Model-space positions useful to the renderer (hit-testing, labels). */
  landmarks() {
    const p = (n) => this.modelPos(this.bones[n]);
    const out = { head: p('Head'), leftEye: p('LeftEye'), rightEye: p('RightEye'), chest: p('Spine2') };
    for (const side of ['right', 'left']) {
      out[side] = { shoulder: this.modelPos(this.bone(side, 'Arm')), elbow: this.modelPos(this.bone(side, 'ForeArm')), wrist: this.modelPos(this.bone(side, 'Hand')), palm: this.handPoint(side, 'center') };
    }
    return out;
  }
}
