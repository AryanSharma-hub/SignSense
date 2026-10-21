import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { computeTargets, describePose, motionPath } from '../lib/pose.js';
import { byId } from '../lib/vocabulary.js';
import { useAnimatedPose } from '../hooks/useAnimatedPose.js';
import { AvatarRig } from '../lib/rig3d/avatarRig.js';
import { realize, motionDelta } from '../lib/rig3d/realize.js';
import { applyClip } from '../lib/rig3d/clip.js';
import { locationDot, K_TORSO } from '../lib/rig3d/bodySpace.js';
import {
  loadAvatar, instantiateAvatar, renderView, addLights, createBackdrop, frameCamera, syncTheme, sharedRenderer, CAMERA_FOV,
} from '../lib/rig3d/sceneKit.js';
import { FRAMINGS, partLabel } from './SignerDummy.jsx';

const key = (o) => JSON.stringify(o);
const SIDES = ['right', 'left'];
const samePart = (a, b) => !!a && !!b && a.k === b.k && (a.side || null) === (b.side || null);
/** Every body part the signer exposes, in hit-test priority order. */
const PARTS = [
  { k: 'H', side: 'right' }, { k: 'H', side: 'left' },
  { k: 'M', side: 'right' }, { k: 'M', side: 'left' },
  { k: 'E' }, { k: 'HD' }, { k: 'L' },
];
const partId = (p) => `${p.k}${p.side ? `-${p.side}` : ''}`;

/** A natural blink every few seconds (0..1 lid closure). */
function blinkAt(ms) {
  const t = (ms / 1000) % 4.3;
  const second = (ms / 1000) % 9.1;
  const one = t < 0.14 ? Math.sin((t / 0.14) * Math.PI) : 0;
  const two = second > 4.6 && second < 4.74 ? Math.sin(((second - 4.6) / 0.14) * Math.PI) : 0;
  return Math.max(one, two);
}

/** Build a view: its own scene and camera around a fresh copy of the avatar. */
function createView(gltf, canvas) {
  sharedRenderer(); // throws when WebGL2 can't start, so the caller falls back to 2D
  syncTheme();
  const scene = new THREE.Scene();
  scene.add(createBackdrop());
  addLights(scene);
  const model = instantiateAvatar(gltf);
  // Shown the way ASL is: the signer faces you, so her dominant right hand is on your left.
  const turntable = new THREE.Group();
  turntable.add(model);
  scene.add(turntable);
  const guides = new THREE.Group();
  model.add(guides);
  const bones = {}, meshes = [];
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh && o.morphTargetDictionary) meshes.push(o); });
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.05, 20);
  return {
    scene, camera, model, turntable, guides, bones, meshes, clipT: 0, clipSpan: null,
    rig: new AvatarRig(model),
    ctx: canvas.getContext('2d'),
    pixels: { w: 1, h: 1 }, css: { w: 1, h: 1 },
    yaw: 0, last: 0, first: true, raf: 0,
  };
}

/** Project a model-space point to CSS pixels in the view. */
function project(v, p) {
  const w = v.model.localToWorld(new THREE.Vector3(p.x, p.y, p.z)).project(v.camera);
  return { x: ((w.x + 1) / 2) * v.css.w, y: ((1 - w.y) / 2) * v.css.h, visible: w.z < 1 };
}

/** Where each part's label / keyboard ring sits, and its proxy collider, in model space. */
function partGeometry(rig) {
  const L = rig.landmarks();
  const eyeY = (L.leftEye.y + L.rightEye.y) / 2;
  const headC = new THREE.Vector3(0, eyeY + 0.005, 0.045);
  const g = {
    E: { at: new THREE.Vector3(0, eyeY - 0.03, 0.15), spheres: [[headC, 0.12]] },
    HD: { at: new THREE.Vector3(0, eyeY + 0.11, 0.06), spheres: [] },
    L: { at: new THREE.Vector3(0, 1.26, 0.17), spheres: [0, 0.25, 0.5, 0.75, 1].map((t) => [new THREE.Vector3(0, 1.04 + 0.34 * t, 0.04), 0.17]) },
  };
  for (const side of SIDES) {
    const a = L[side];
    const caps = (A, B, r) => [0, 0.25, 0.5, 0.75, 1].map((t) => [A.clone().lerp(B, t), r]);
    g[`M-${side}`] = { at: a.elbow, spheres: [...caps(a.shoulder, a.elbow, 0.055), ...caps(a.elbow, a.wrist, 0.048)] };
    g[`H-${side}`] = { at: a.palm, spheres: [[a.palm, 0.07]] };
  }
  g.eyeY = eyeY;
  return g;
}

/**
 * The 3D signer: a realistic rigged human drawn with Three.js. Same props, same pose
 * snapshot, same animation (useAnimatedPose) as the 2D SignerDummy — the frame is solved
 * onto the avatar's skeleton by lib/rig3d — so playback, editing and every page behave the
 * same. Interactive mode keeps every body part tappable (and keyboard reachable), hands and
 * face draggable for movements, location dots on the body, and drag-empty-space to turn.
 */
export function Signer3D({
  pose, vocab, compact = false, idle = !compact, interactive = false,
  onHandTap, onHeadTap, onDragPreview, onDragCommit, onPartSelect,
  selectedPart = null, editingHand = null,
  locationTargets = null, guides = false, speed = 1, paused = false,
  framing = 'full', fit = 'width', className = '', onFail,
  clip = null, clipSpan = null,
}) {
  const targets = useMemo(() => computeTargets(pose, vocab), [key(pose), vocab]); // eslint-disable-line react-hooks/exhaustive-deps
  const headFamily = byId(vocab, 'HD', pose?.HD)?.family ?? null;
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const viewRef = useRef(null);
  const partRefs = useRef({});
  const locRefs = useRef({});
  const dragRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [drag, setDrag] = useState(null);
  const [tag, setTag] = useState(null);
  const [hover, setHover] = useState(null);
  const [orbiting, setOrbiting] = useState(false);

  const effective = useMemo(() => {
    if (!drag) return targets;
    if (drag.kind === 'hand') {
      const h = targets.hands[drag.side];
      return { ...targets, hands: { ...targets.hands, [drag.side]: { ...h, x: h.x + drag.dx, y: h.y + drag.dy, active: true, motion: null } } };
    }
    return { ...targets, head: { ...targets.head, dx: drag.dx * 0.5, dy: drag.dy * 0.35 } };
  }, [targets, drag]);

  const frame = useAnimatedPose(effective, { idle, speed, paused });
  const live = useRef({});
  live.current = { frame, effective, pose, headFamily, framing, idle, speed, paused, interactive, locationTargets, clip, clipSpan };

  /* ----- draw: solve the frame onto the skeleton, place overlays, render ----- */
  const draw = useCallback(() => {
    const v = viewRef.current;
    if (!v) return;
    const s = live.current;
    const now = performance.now();
    const elapsed = v.first ? 0 : (now - v.last) / 1000;
    const dt = Math.min(0.05, elapsed) * (s.paused ? 0 : s.speed);
    // A clip keeps real time (in step with the player) however slowly frames are drawn.
    const clipDt = Math.min(0.5, elapsed) * (s.paused ? 0 : s.speed);
    v.last = now;
    v.first = false;

    v.turntable.rotation.y = v.yaw;
    frameCamera(v.camera, s.framing, v.css.w / Math.max(1, v.css.h));
    v.scene.updateMatrixWorld(true);
    let settled;
    if (s.clip && s.clipSpan) {
      // Recorded signing: play this word's stretch of the clip (the player owns the timing).
      const [a, b] = s.clipSpan;
      if (v.clipSpan !== s.clipSpan) { // a new span: the next word continues, anything else restarts
        const next = v.clipSpan && Math.abs(v.clipSpan[1] - a) < 1e-6 && v.clipT >= v.clipSpan[1] - 0.06;
        if (!next) v.clipT = a;
        v.clipSpan = s.clipSpan;
      }
      v.clipT = Math.min(b, Math.max(a, v.clipT + clipDt));
      applyClip(s.clip, v.clipT, v.bones, v.meshes);
      v.model.updateMatrixWorld(true);
      settled = v.clipT >= b || s.paused;
    } else {
      v.clipSpan = null;
      const gaze = v.model.worldToLocal(v.camera.position.clone());
      settled = v.rig.apply({
        ...realize(s.frame, s.effective, { vocab, pose: s.pose, headFamily: s.headFamily }),
        blink: s.idle ? blinkAt(now) : 0, gaze, dt,
      });
    }

    if (s.interactive) {
      v.parts = partGeometry(v.rig);
      for (const p of PARTS) {
        const el = partRefs.current[partId(p)];
        if (!el) continue;
        const at = project(v, v.parts[partId(p)].at);
        el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
      }
    }
    if (s.locationTargets) {
      for (const l of vocab.locations) {
        const el = locRefs.current[l.id];
        if (!el) continue;
        const at = project(v, locationDot(l));
        el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
      }
    }
    renderView(v);
    if (!settled && !v.raf) v.raf = requestAnimationFrame(() => { v.raf = 0; draw(); });
  }, [vocab]);

  /* ----- lifecycle: load the avatar, size the canvas, follow the theme ----- */
  useEffect(() => {
    let disposed = false;
    loadAvatar()
      .then((gltf) => {
        if (disposed) return;
        try {
          viewRef.current = createView(gltf, canvasRef.current);
          setStatus('ready');
        } catch (e) { setStatus('error'); onFail?.(e); }
      })
      .catch((e) => { if (!disposed) { setStatus('error'); onFail?.(e); } });
    return () => {
      disposed = true;
      const v = viewRef.current;
      if (v) { cancelAnimationFrame(v.raf); v.guides.clear(); }
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const resize = () => {
      const v = viewRef.current, el = wrapRef.current, c = canvasRef.current;
      if (!v || !el || !c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      v.css = { w, h };
      v.pixels = { w: Math.round(w * dpr), h: Math.round(h * dpr) };
      c.width = v.pixels.w; c.height = v.pixels.h;
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);
    resize();
    const mo = new MutationObserver(() => { syncTheme(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [status, compact, draw]);

  useEffect(() => { draw(); }, [frame, effective, framing, status, draw, interactive, locationTargets, clip, clipSpan]);

  /* ----- guides: skeleton and movement paths ----- */
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return undefined;
    v.guides.clear();
    if (!guides) { draw(); return undefined; }
    const helper = new THREE.SkeletonHelper(v.model);
    helper.material.depthTest = false;
    helper.material.transparent = true;
    helper.material.opacity = 0.55;
    v.scene.add(helper);
    const movement = new THREE.Color(`rgb(${getComputedStyle(document.documentElement).getPropertyValue('--movement').trim().split(/\s+/).join(',')})`);
    const made = [];
    const still = { ...frame, right: { ...frame.right, ox: 0, oy: 0 }, left: { ...frame.left, ox: 0, oy: 0 } };
    const spec = realize(still, targets, { vocab, pose, headFamily });
    for (const side of SIDES) {
      const h = targets.hands[side];
      const goal = spec.hands[side].goal;
      if (!h.motion || !goal.point) continue;
      const normal = goal.normal ?? { x: 0, y: 0, z: 1 };
      const pts = motionPath(h.motion).map((o) => {
        const d = motionDelta(o.x, o.y, h.motion.kind, !!h.contact && !h.near, normal);
        return new THREE.Vector3(goal.point.x + d.x, goal.point.y + d.y, goal.point.z + d.z);
      });
      if (pts.length < 2) continue;
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: movement, dashSize: 0.012, gapSize: 0.008, depthTest: false, transparent: true }));
      line.computeLineDistances();
      line.renderOrder = 10;
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 12), new THREE.MeshBasicMaterial({ color: movement, depthTest: false }));
      cone.position.copy(b);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      cone.renderOrder = 10;
      v.guides.add(line, cone);
      made.push(geo, line.material, cone.geometry, cone.material);
    }
    draw();
    return () => {
      v.scene.remove(helper);
      helper.dispose();
      v.guides.clear();
      made.forEach((m) => m.dispose());
    };
  }, [guides, targets, status, draw]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- pointer interaction ----- */
  const local = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hitTest = (pt) => {
    const v = viewRef.current;
    if (!v?.parts) return null;
    const ndc = new THREE.Vector2((pt.x / v.css.w) * 2 - 1, -(pt.y / v.css.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, v.camera);
    const toModel = v.model.matrixWorld.clone().invert();
    const r = ray.ray.clone().applyMatrix4(toModel);
    let best = null;
    const hit = new THREE.Vector3();
    for (const p of PARTS) {
      if (p.k === 'HD') continue; // the crown is the top of the head sphere
      for (const [c, rad] of v.parts[partId(p)].spheres) {
        if (!r.intersectSphere(new THREE.Sphere(c, rad), hit)) continue;
        const d = hit.distanceTo(r.origin) - (p.k === 'H' ? 0.04 : 0);
        if (!best || d < best.d) best = { d, part: p.k === 'E' && hit.y > v.parts.eyeY + 0.045 ? { k: 'HD' } : p, at: hit.clone() };
      }
    }
    if (best) best.depth = v.model.localToWorld(best.at.clone()).distanceTo(v.camera.position);
    return best;
  };
  const unitsPerPx = (depth) => {
    const v = viewRef.current;
    return (2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * depth) / Math.max(1, v.css.h) / K_TORSO;
  };

  const tap = (part) => {
    if (part.k === 'H') onHandTap?.(part.side);
    if (part.k === 'E') onHeadTap?.();
    onPartSelect?.(part);
  };

  const onPointerDown = (e) => {
    if (!interactive || status !== 'ready') return;
    const pt = local(e);
    const h = hitTest(pt);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (h) {
      const kind = h.part.k === 'H' ? 'hand' : h.part.k === 'E' ? 'head' : null;
      dragRef.current = { part: h.part, kind, side: h.part.side ?? null, start: pt, moved: false, rel: { x: 0, y: 0 }, scale: unitsPerPx(h.depth) };
    } else {
      dragRef.current = { orbit: true, start: pt, yaw0: viewRef.current?.yaw ?? 0 };
      setOrbiting(true);
    }
  };
  const onPointerMove = (e) => {
    if (!interactive || status !== 'ready') return;
    const pt = local(e);
    const d = dragRef.current;
    if (!d) {
      const h = hitTest(pt);
      setHover(h ? { part: h.part, x: pt.x, y: pt.y } : null);
      return;
    }
    if (d.orbit) {
      const v = viewRef.current;
      if (v) { v.yaw = Math.max(-1, Math.min(1, d.yaw0 + (pt.x - d.start.x) * 0.008)); draw(); }
      return;
    }
    if (!d.kind) return;
    // The signer faces the viewer: dragging to the viewer's right is toward HER left (2D -x).
    const rel = { x: -(pt.x - d.start.x) * d.scale, y: (pt.y - d.start.y) * d.scale };
    if (!d.moved && Math.hypot(pt.x - d.start.x, pt.y - d.start.y) < 6) return; // still a tap
    d.moved = true; d.rel = rel;
    const lim = d.kind === 'hand' ? 26 : 14, len = Math.hypot(rel.x, rel.y), k = len > lim ? lim / len : 1;
    setDrag({ kind: d.kind, side: d.side, dx: rel.x * k, dy: rel.y * k });
    const text = onDragPreview?.(d.kind, d.side, rel);
    setTag(text ? { x: pt.x, y: pt.y, text } : null);
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null; setDrag(null); setTag(null); setOrbiting(false);
    if (!d || d.orbit) return;
    if (!d.moved) tap(d.part);
    else onDragCommit?.(d.kind, d.side, d.rel);
  };
  const onPointerCancel = () => { dragRef.current = null; setDrag(null); setTag(null); setOrbiting(false); };
  const resetTurn = () => { const v = viewRef.current; if (v) { v.yaw = 0; draw(); } };

  // Keyboard: every part is a real button; Enter/Space opens it, arrows on a hand or the face commit a movement.
  // Arrow keys follow the screen; the signer faces the viewer, so screen-left is her right (2D +x).
  const ARROWS = { ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 }, ArrowLeft: { x: 30, y: 0 }, ArrowRight: { x: -30, y: 0 } };
  const keys = (part) => (e) => {
    const kind = part.k === 'H' ? 'hand' : part.k === 'E' ? 'head' : null;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(part); }
    else if (kind && ARROWS[e.key]) { e.preventDefault(); onDragCommit?.(kind, part.side ?? null, ARROWS[e.key]); }
  };

  const label = describePose(pose, vocab);
  const vb = FRAMINGS[framing] || FRAMINGS.full;
  const sizing = fit === 'contain' ? 'h-full w-full' : 'w-full';
  const cursor = !interactive ? undefined : orbiting ? 'grabbing' : hover ? 'pointer' : 'grab';

  return (
    <div
      ref={wrapRef}
      className={`signer3d relative overflow-hidden rounded-[inherit] ${sizing} ${className}`}
      style={fit === 'contain' ? undefined : { aspectRatio: `${vb.w} / ${vb.h}` }}
    >
      <canvas
        ref={canvasRef} role="img"
        aria-label={`Signer${label ? `: ${label}` : ' at rest'}`}
        className="absolute inset-0 block h-full w-full select-none"
        style={{ touchAction: interactive ? 'none' : undefined, cursor }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel} onPointerLeave={() => !dragRef.current && setHover(null)}
        onDoubleClick={interactive ? resetTurn : undefined}
      />

      {status === 'loading' && (
        <div className="signer3d-loading absolute inset-0 grid place-items-center" role="status">
          <span className="rounded-full bg-surface/80 px-3 py-1.5 text-[13px] font-semibold text-muted shadow-soft">Loading the signer…</span>
        </div>
      )}

      {/* keyboard-reachable body parts, kept over their place on the figure */}
      {interactive && status === 'ready' && (
        <div className="pointer-events-none absolute inset-0">
          {PARTS.map((p) => {
            const on = samePart(p, selectedPart);
            const ring = p.k === 'H' && editingHand === p.side && !on;
            return (
              <button
                key={partId(p)} ref={(el) => { partRefs.current[partId(p)] = el; }}
                type="button" aria-pressed={on}
                aria-label={partLabel(p) + (p.k === 'H' ? '. Use arrow keys for its movement.' : p.k === 'E' ? '. Use arrow keys for head movement.' : '')}
                onKeyDown={keys(p)}
                className={`part-3d absolute left-0 top-0 ${on ? 'is-selected' : ''} ${ring ? 'is-editing' : ''}`}
              />
            );
          })}
        </div>
      )}

      {/* location targets: where on the body the sign is made */}
      {locationTargets && status === 'ready' && (
        <div className="pointer-events-none absolute inset-0">
          {vocab.locations.map((l) => {
            const on = locationTargets.selected === l.id;
            return (
              <button
                key={l.id} ref={(el) => { locRefs.current[l.id] = el; }}
                type="button" aria-label={`Location: ${l.label}`} aria-pressed={on} title={l.label}
                onClick={() => locationTargets.onPick(l.id)}
                className={`loc-3d pointer-events-auto absolute left-0 top-0 ${on ? 'is-on' : ''}`}
              >
                {on && <span className="loc-3d-label">{l.label}</span>}
              </button>
            );
          })}
        </div>
      )}

      {interactive && !tag && hover && (
        <span className="signer3d-tag is-accent" style={{ left: hover.x, top: hover.y }}>{partLabel(hover.part).split(' — ')[0]}</span>
      )}
      {tag && <span className="signer3d-tag" style={{ left: tag.x, top: tag.y }}>{tag.text}</span>}
    </div>
  );
}
