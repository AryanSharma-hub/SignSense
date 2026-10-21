/**
 * Reader for the `.pose` binary format (sign-language-processing/pose, versions 0.1 / 0.2),
 * the format sign.mt serves: MediaPipe Holistic landmarks per frame.
 *
 * Layout (little-endian):
 *   header  f32 version; u16 width, height, depth; u16 component count; per component:
 *           str name; str point format (e.g. "XYZC"); u16 points, limbs, colours;
 *           str point names...; u16 pairs (limbs); u16 triples (colours)
 *   body    v0.2: f32 fps; u32 frames; u16 people     v0.1: u16 fps; u16 frames; u16 people
 *           f32 data[frames][people][points][dims]; f32 confidence[frames][people][points]
 *   str     u16 byte length + UTF-8 bytes
 */
export function readPose(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let o = 0;
  const u16 = () => { const v = buf.readUInt16LE(o); o += 2; return v; };
  const u32 = () => { const v = buf.readUInt32LE(o); o += 4; return v; };
  const f32 = () => { const v = buf.readFloatLE(o); o += 4; return v; };
  const str = () => { const n = u16(); const s = buf.toString('utf8', o, o + n); o += n; return s; };

  const version = Math.round(f32() * 1000) / 1000;
  if (version !== 0.1 && version !== 0.2) throw new Error(`unsupported .pose version ${version}`);
  const dimensions = { width: u16(), height: u16(), depth: u16() };
  const components = [];
  for (let c = u16(); c > 0; c--) {
    const name = str(), format = str();
    const nPoints = u16(), nLimbs = u16(), nColors = u16();
    const points = Array.from({ length: nPoints }, str);
    o += nLimbs * 4 + nColors * 6;
    components.push({ name, format, points });
  }
  const fps = version === 0.2 ? f32() : u16();
  if (version === 0.2) u32(); else u16(); // stored frame count (can overflow; recomputed below)
  const people = u16();
  const nPoints = components.reduce((s, c) => s + c.points.length, 0);
  const dims = Math.max(...components.map((c) => c.format.length)) - 1;
  const frames = Math.floor((buf.length - o) / (people * nPoints * (dims + 1) * 4));
  const data = new Float32Array(frames * people * nPoints * dims);
  for (let i = 0; i < data.length; i++, o += 4) data[i] = buf.readFloatLE(o);
  const confidence = new Float32Array(frames * people * nPoints);
  for (let i = 0; i < confidence.length; i++, o += 4) confidence[i] = buf.readFloatLE(o);
  return { version, dimensions, components, fps, frames, people, points: nPoints, dims, data, confidence };
}

const POSE_KEYS = { LEFT_SHOULDER: 'LS', RIGHT_SHOULDER: 'RS', LEFT_ELBOW: 'LE', RIGHT_ELBOW: 'RE', LEFT_WRIST: 'LW', RIGHT_WRIST: 'RW', LEFT_HIP: 'LH', RIGHT_HIP: 'RH' };

/**
 * A pose file as a landmark clip for lib/rig3d/retarget.js: per frame the body points
 * (shoulders, elbows, wrists, hips), both hands' 21 points and the face points by MediaPipe
 * index, each {x, y, c} in image coordinates. Person 0 only.
 */
export function toLandmarkClip(pose) {
  const { components, frames, people, points, dims, data, confidence } = pose;
  const offset = {};
  let k = 0;
  for (const c of components) { offset[c.name] = k; k += c.points.length; }
  const at = (t, i) => {
    const base = (t * people * points + i);
    return { x: data[base * dims], y: data[base * dims + 1], c: confidence[base] };
  };
  const comp = (name) => components.find((c) => c.name === name);
  const body = comp('POSE_LANDMARKS'), face = comp('FACE_LANDMARKS');
  const hand = (name, t) => {
    const c = comp(name);
    if (!c) return null;
    const pts = c.points.map((_, i) => at(t, offset[name] + i));
    return pts.some((p) => p.c > 0) ? pts : null;
  };
  const out = [];
  for (let t = 0; t < frames; t++) {
    const pose = {};
    body?.points.forEach((n, i) => { if (POSE_KEYS[n]) pose[POSE_KEYS[n]] = at(t, offset[body.name] + i); });
    let f = null;
    if (face) {
      f = {};
      face.points.forEach((n, i) => { const p = at(t, offset[face.name] + i); if (p.c > 0) f[n] = p; });
    }
    out.push({ pose, hands: { right: hand('RIGHT_HAND_LANDMARKS', t), left: hand('LEFT_HAND_LANDMARKS', t) }, face: f });
  }
  return { fps: pose.fps, frames: out };
}
