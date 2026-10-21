import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated caches, an in-memory database, and a stand-in for sign.mt (no network in tests).
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signsense-signing-'));
process.env.DATA_DIR = dataDir;
process.env.PGLITE_DIR = ':memory:';
process.env.SIGNMT_URL = 'http://signmt.test/spoken_text_to_signed_pose';
delete process.env.DATABASE_URL;

const { readPose, toLandmarkClip } = await import('../src/signing/poseFormat.js');
const { animateWords } = await import('../src/signing/animate.js');
const { createDb } = await import('../src/db/adapter.js');
const { migrate, seedIfEmpty } = await import('../src/db/seed.js');
const { createApp } = await import('../src/app.js');

/* ---------- a .pose writer (v0.2), for synthetic recordings ---------- */

function encodePose({ fps = 25, components, frames }) {
  const parts = [];
  const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); parts.push(b); };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); parts.push(b); };
  const f32 = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); parts.push(b); };
  const str = (s) => { const b = Buffer.from(s, 'utf8'); u16(b.length); parts.push(b); };
  f32(0.2); u16(512); u16(512); u16(0); u16(components.length);
  for (const c of components) { str(c.name); str('XYZC'); u16(c.points.length); u16(0); u16(0); c.points.forEach(str); }
  f32(fps); u32(frames.length); u16(1);
  for (const f of frames) for (const p of f) { f32(p[0]); f32(p[1]); f32(p[2]); }
  for (const f of frames) for (const p of f) f32(p[3]);
  return Buffer.concat(parts);
}

const BODY = ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW', 'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_HIP', 'RIGHT_HIP'];
const FACE = ['10', '152', '33', '263', '234', '454', '13', '14', '61', '291', '105', '334', '159', '145', '386', '374'];
const HAND = ['WRIST', 'THUMB_CMC', 'THUMB_MCP', 'THUMB_IP', 'THUMB_TIP', ...['INDEX_FINGER', 'MIDDLE_FINGER', 'RING_FINGER', 'PINKY'].flatMap((f) => [`${f}_MCP`, `${f}_PIP`, `${f}_DIP`, `${f}_TIP`])];
const COMPONENTS = [
  { name: 'POSE_LANDMARKS', points: BODY },
  { name: 'FACE_LANDMARKS', points: FACE },
  { name: 'LEFT_HAND_LANDMARKS', points: HAND },
  { name: 'RIGHT_HAND_LANDMARKS', points: HAND },
];

/**
 * A synthetic recording of a signer facing the camera (image y down; the signer's right is
 * on the image's left). One hand rises from the hip to the chin with a flat hand, fingers
 * up, and goes back down; the other hangs. `hand` picks which one signs.
 */
function synthRecording(hand = 'right', n = 50) {
  const S = { L: [300, 250], R: [212, 250] };
  const face = { 10: [256, 95], 152: [256, 190], 33: [228, 135], 263: [284, 135], 234: [215, 140], 454: [297, 140], 13: [256, 168], 14: [256, 172], 61: [240, 170], 291: [272, 170], 105: [235, 120], 334: [277, 120], 159: [236, 131], 145: [236, 139], 386: [276, 131], 374: [276, 139] };
  const frames = [];
  for (let t = 0; t < n; t++) {
    const u = Math.sin((Math.PI * t) / (n - 1)); // 0 -> 1 -> 0
    const side = hand === 'right' ? -1 : 1; // image x direction of the signing side
    const sx = hand === 'right' ? S.R[0] : S.L[0];
    const wrist = [sx + side * (40 - 70 * u), 430 - 230 * u];
    const elbow = [sx + side * (30 + 10 * u), 340 - 40 * u];
    const rest = { wrist: [hand === 'right' ? S.L[0] + 40 : S.R[0] - 40, 430], elbow: [hand === 'right' ? S.L[0] + 30 : S.R[0] - 30, 340] };
    const signing = hand === 'right' ? 'R' : 'L';
    const pose = {
      LEFT_SHOULDER: S.L, RIGHT_SHOULDER: S.R,
      LEFT_ELBOW: signing === 'L' ? elbow : rest.elbow, RIGHT_ELBOW: signing === 'R' ? elbow : rest.elbow,
      LEFT_WRIST: signing === 'L' ? wrist : rest.wrist, RIGHT_WRIST: signing === 'R' ? wrist : rest.wrist,
      LEFT_HIP: [290, 470], RIGHT_HIP: [222, 470],
    };
    const handPts = (w) => {
      const pts = [w];
      const thumbDir = hand === 'right' ? 1 : -1;
      pts.push([w[0] + thumbDir * 8, w[1] - 8], [w[0] + thumbDir * 14, w[1] - 16], [w[0] + thumbDir * 18, w[1] - 24], [w[0] + thumbDir * 21, w[1] - 31]);
      for (let f = 0; f < 4; f++) {
        const x = w[0] + thumbDir * (6 - f * 5);
        for (let j = 0; j < 4; j++) pts.push([x, w[1] - 22 - j * 9]);
      }
      return pts;
    };
    const row = [];
    for (const name of BODY) row.push([...pose[name], 0, 1]);
    for (const i of FACE) row.push([...face[i], 0, 1]);
    for (const h of ['L', 'R']) {
      const visible = h === signing && u > 0.15;
      const pts = visible ? handPts(h === 'L' ? pose.LEFT_WRIST : pose.RIGHT_WRIST) : Array.from({ length: 21 }, () => [0, 0]);
      for (const p of pts) row.push([...p, 0, visible ? 1 : 0]);
    }
    frames.push(row);
  }
  return encodePose({ components: COMPONENTS, frames });
}

const decode = (b64) => { const b = Buffer.from(b64, 'base64'); return Array.from(new Int16Array(b.buffer, b.byteOffset, b.length / 2), (v) => v / 32767); };

/* ---------- the stand-in sign.mt ---------- */

const realFetch = globalThis.fetch;
let signmtCalls = 0;
before(() => {
  globalThis.fetch = async (url, init) => {
    const u = new URL(url);
    if (u.host !== 'signmt.test') return realFetch(url, init);
    signmtCalls++;
    const text = u.searchParams.get('text');
    if (text === 'broken') return new Response('nope', { status: 500 });
    return new Response(synthRecording(text === 'lefty' ? 'left' : 'right'), { status: 200 });
  };
});
after(() => { globalThis.fetch = realFetch; fs.rmSync(dataDir, { recursive: true, force: true }); });

/* ---------- tests ---------- */

test('reads the .pose format: header, components, frames, confidence', () => {
  const pose = readPose(synthRecording('right', 12));
  assert.equal(pose.version, 0.2);
  assert.equal(pose.fps, 25);
  assert.equal(pose.frames, 12);
  assert.deepEqual(pose.components.map((c) => c.name), COMPONENTS.map((c) => c.name));
  const clip = toLandmarkClip(pose);
  assert.equal(clip.frames.length, 12);
  assert.deepEqual(clip.frames[0].pose.RS, { x: 212, y: 250, c: 1 });
  assert.equal(clip.frames[0].hands.right, null); // not yet visible
  assert.equal(clip.frames[6].hands.right.length, 21);
  assert.ok(clip.frames[6].face['152']);
});

test('turns words into one clip for the rig: every bone, every frame, words in order', async () => {
  const clip = await animateWords(['hello', 'mother']);
  assert.equal(clip.encoding, 'int16-base64');
  assert.ok(clip.bones.includes('RightHand') && clip.bones.includes('LeftHandIndex3'));
  assert.equal(clip.frames.length, clip.face.length);
  const per = clip.bones.length * 4;
  for (const f of clip.frames) {
    const q = decode(f);
    assert.equal(q.length, per);
    for (let i = 0; i < q.length; i += 4) assert.ok(Math.abs(Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3]) - 1) < 0.01, 'unit quaternions');
  }
  assert.deepEqual(clip.words.map((w) => w.text), ['hello', 'mother']);
  assert.ok(clip.words[0].start > 0 && clip.words[0].end <= clip.words[1].start && clip.words[1].end < clip.frames.length);
});

test('starts and ends at rest, so sentences join smoothly', async () => {
  const clip = await animateWords(['hello']);
  assert.deepEqual(clip.frames[0], clip.frames.at(-1));
});

test('signs a left-handed recording with the right hand (mirrored)', async () => {
  const clip = await animateWords(['lefty']);
  assert.equal(clip.words[0].mirrored, true);
  const right = await animateWords(['hello']);
  assert.equal(right.words[0].mirrored, false);
});

test('caches each word: a repeated word is not fetched again', async () => {
  const before = signmtCalls;
  await animateWords(['cached word']);
  await animateWords(['cached word', 'cached word']);
  assert.equal(signmtCalls - before, 1);
});

test('signs a multi-digit number digit by digit, as one word', async () => {
  const before = signmtCalls;
  const clip = await animateWords(['2024']);
  assert.equal(clip.words.length, 1);
  assert.equal(clip.words[0].text, '2024');
  assert.ok(signmtCalls - before >= 3 && signmtCalls - before <= 4); // 2, 0, 4 (2 is repeated, cached)
});

test('fails cleanly when the recording is unavailable', async () => {
  await assert.rejects(() => animateWords(['broken']), /500/);
});

test('POST /api/signing/animate: validates, needs the CSRF header, returns the clip', async () => {
  const db = await createDb();
  await migrate(db);
  await seedIfEmpty(db);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = { 'x-requested-with': 'SignSense' }) =>
    realFetch(`${base}/api/signing/animate`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({ words: ['hello'] }, {})).status, 403);
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ words: Array(30).fill('x') })).status, 400);
    const ok = await post({ words: ['hello'] });
    assert.equal(ok.status, 200);
    const clip = await ok.json();
    assert.equal(clip.words[0].text, 'hello');
    const bad = await post({ words: ['broken'] });
    assert.equal(bad.status, 502);
  } finally {
    server.close();
    await db.close();
  }
});
