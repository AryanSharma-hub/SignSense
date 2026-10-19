import { describe, it, expect } from 'vitest';
import { solveTwoBone, solveArm, elbowAngle } from '../rig/ik.js';
import { solveFigure, guardFace, separateHands } from '../rig/solveFigure.js';
import { BODY, LIMITS, normDeg } from '../rig/skeleton.js';
import { FACE_PARAMS, FACE_KEYS } from '../rig/face.js';
import { computeTargets, motionOffset, motionPath } from '../pose.js';
import { vocab, gestures } from './helpers.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

describe('two-bone IK', () => {
  const S = { x: 0, y: 0 };
  it('keeps bone lengths exact and lands on reachable targets', () => {
    const r = solveTwoBone(S, { x: 30, y: 50 }, 40, 38, { x: 1, y: 0.5 });
    expect(near(dist(S, r.elbow), 40)).toBe(true);
    expect(near(dist(r.elbow, r.wrist), 38)).toBe(true);
    expect(dist(r.wrist, { x: 30, y: 50 })).toBeLessThan(0.01);
    expect(r.stretch).toBeCloseTo(0, 5);
  });
  it('bends toward the pole, never the other way', () => {
    const out = solveTwoBone(S, { x: 0, y: 60 }, 40, 38, { x: 1, y: 0 });
    const inn = solveTwoBone(S, { x: 0, y: 60 }, 40, 38, { x: -1, y: 0 });
    expect(out.elbow.x).toBeGreaterThan(0);
    expect(inn.elbow.x).toBeLessThan(0);
  });
  it('clamps out-of-reach targets and never folds past the elbow limit', () => {
    const far = solveTwoBone(S, { x: 0, y: 200 }, 40, 38, { x: 1, y: 0 });
    expect(far.stretch).toBeGreaterThan(100);
    expect(dist(S, far.wrist)).toBeLessThanOrEqual(78);
    const close = solveTwoBone(S, { x: 1, y: 1 }, 40, 38, { x: 1, y: 0 });
    expect(elbowAngle(S, close.elbow, close.wrist)).toBeGreaterThanOrEqual(LIMITS.elbowMinDeg - 0.01);
  });
});

describe('arm solve (hierarchical: shoulder -> elbow -> wrist -> hand)', () => {
  it('reaches signing-space targets and keeps the hand attached to the wrist', () => {
    for (const side of ['right', 'left']) {
      const sx = side === 'right' ? 1 : -1;
      const target = { x: 120 + sx * 30, y: 170, w: 1 };
      const a = solveArm(side, target);
      expect(dist(a.hand, target)).toBeLessThan(0.5);
      expect(near(dist(a.wrist, a.hand), BODY.wristToPalm)).toBe(true);
      expect(near(dist(a.shoulder, a.elbow), BODY.upperArm)).toBe(true);
      expect(near(dist(a.elbow, a.wrist), BODY.forearm)).toBe(true);
    }
  });
  it('mirrors exactly between sides (handedness only flips x)', () => {
    const r = solveArm('right', { x: 150, y: 120, w: 1 });
    const l = solveArm('left', { x: 90, y: 120, w: 1 });
    expect(r.elbow.x - 120).toBeCloseTo(120 - l.elbow.x, 6);
    expect(r.elbow.y).toBeCloseTo(l.elbow.y, 6);
    expect(r.hand.angle).toBeCloseTo(-l.hand.angle, 6);
  });
  it('carries elbows outward of the shoulders, not across the body', () => {
    const r = solveArm('right', { x: 135, y: 160, w: 1 });
    const l = solveArm('left', { x: 105, y: 160, w: 1 });
    expect(r.elbow.x).toBeGreaterThan(r.hand.x);
    expect(l.elbow.x).toBeLessThan(l.hand.x);
  });
  it('limits wrist bend, and lets a resting hand hang along the forearm', () => {
    const up = solveArm('right', { x: 140, y: 150, w: 1 });
    const follow = normDeg(Math.atan2(up.wrist.y - up.elbow.y, up.wrist.x - up.elbow.x) * 180 / Math.PI + 90);
    expect(Math.abs(normDeg(up.hand.angle - follow))).toBeLessThanOrEqual(LIMITS.wristDeg + 2);
    const rest = solveArm('right', { x: 176, y: 234, w: 0 });
    expect(Math.abs(rest.hand.angle)).toBeGreaterThan(120); // fingers pointing down
  });
  it('lifts the shoulder toward a target above it', () => {
    const a = solveArm('right', { x: 140, y: 60, w: 1 });
    expect(a.shoulder.y).toBeLessThan(BODY.shoulder.right.y);
  });
});

describe('collision correction', () => {
  it('keeps a hand out of the face unless the sign is made at the head', () => {
    const inside = { x: 120, y: 90 };
    const pushed = guardFace(inside, 'body');
    const { cx, cy, rx, ry } = BODY.head;
    expect(((pushed.x - cx) / rx) ** 2 + ((pushed.y - cy) / ry) ** 2).toBeGreaterThan(1);
    expect(guardFace(inside, 'head')).toBe(inside);
  });
  it('eases independent hands apart but lets joined hands meet', () => {
    const a = { x: 120, y: 170, w: 1 }, b = { x: 121, y: 170, w: 1 };
    const s = separateHands(a, b, false);
    expect(dist(s.right, s.left)).toBeGreaterThanOrEqual(LIMITS.handGap - 0.01);
    expect(separateHands(a, b, true)).toEqual({ right: a, left: b });
  });
  it('solves every sign in the library to a valid skeleton (no NaN, bones intact)', () => {
    for (const g of gestures) {
      for (const step of g.signForm) {
        const t = computeTargets(step, vocab);
        const frame = {};
        for (const side of ['right', 'left']) {
          const h = t.hands[side], off = motionOffset(h.motion, 0.3);
          frame[side] = { x: h.x + off.x, y: h.y + off.y, alpha: h.active ? 1 : 0.4 };
        }
        const fig = solveFigure(frame, t);
        for (const side of ['right', 'left']) {
          const a = fig[side];
          for (const p of [a.shoulder, a.elbow, a.wrist, a.hand]) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
          expect(near(dist(a.shoulder, a.elbow), BODY.upperArm, 0.01)).toBe(true);
          expect(near(dist(a.elbow, a.wrist), BODY.forearm, 0.01)).toBe(true);
          expect(elbowAngle(a.shoulder, a.elbow, a.wrist)).toBeGreaterThanOrEqual(LIMITS.elbowMinDeg - 0.01);
        }
        expect(fig.order).toHaveLength(2);
      }
    }
  });
});

describe('face and motion data', () => {
  it('has a complete face for every expression family in the vocabulary', () => {
    for (const e of vocab.expressions) {
      const f = FACE_PARAMS[e.family];
      expect(f, e.family).toBeTruthy();
      FACE_KEYS.forEach((k) => expect(Number.isFinite(f[k])).toBe(true));
    }
  });
  it('samples movement paths that start at the anchor and travel for strokes', () => {
    const p = motionPath({ kind: 'stroke', x: 0, y: -20 });
    expect(p[0].x).toBeCloseTo(0);
    expect(p[0].y).toBeCloseTo(0);
    expect(p[p.length - 1].y).toBeLessThan(-15);
    expect(motionPath(null)).toEqual([]);
  });
});
