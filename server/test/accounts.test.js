import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PGLITE_DIR = ':memory:';
delete process.env.DATABASE_URL;

const { createDb } = await import('../src/db/adapter.js');
const { migrate, seedIfEmpty } = await import('../src/db/seed.js');
const { seedLessons, buildLessonPlan } = await import('../src/db/lessons.js');
const { createApp } = await import('../src/app.js');
const { ensureAdmin, hashPassword, verifyPassword } = await import('../src/auth/index.js');
const { buildTest, gradeTest, nextBox, streakDays } = await import('../src/learn/engine.js');
const { getGestures } = await import('../src/db/queries.js');

let db, server, base;
before(async () => {
  db = await createDb();
  await migrate(db);
  await seedIfEmpty(db);
  await seedLessons(db);
  await ensureAdmin(db, { email: 'admin@example.com', password: 'admin-pass-123', name: 'Ada Admin' });
  server = createApp(db).listen(0);
  server.keepAliveTimeout = 60_000;
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.close(); });

/** A tiny cookie-keeping client, like a browser tab. */
function client() {
  let cookie = '';
  const call = async (method, path, body, { csrf = true } = {}) => {
    const headers = { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-requested-with': 'SignSense' } : {}) };
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let json = null; try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json, setCookie: set };
  };
  return {
    get: (p) => call('GET', p), post: (p, b, o) => call('POST', p, b ?? {}, o), put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b), del: (p) => call('DELETE', p),
  };
}

test('passwords are salted scrypt hashes and verify in constant time', async () => {
  const h1 = await hashPassword('correct horse'), h2 = await hashPassword('correct horse');
  assert.notEqual(h1, h2);
  assert.match(h1, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('correct horse', h1), true);
  assert.equal(await verifyPassword('wrong horse', h1), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('register, session cookie, me, logout', async () => {
  const c = client();
  assert.equal((await c.get('/api/auth/me')).body.user, null);
  const bad = await c.post('/api/auth/register', { email: 'nope', password: 'short', name: 'X' });
  assert.equal(bad.status, 400);
  const reg = await c.post('/api/auth/register', { email: 'Lee@Example.com', password: 'learner-pass-1', name: 'Lee' });
  assert.equal(reg.status, 201);
  assert.match(reg.setCookie, /HttpOnly/);
  assert.match(reg.setCookie, /SameSite=Lax/);
  assert.equal(reg.body.user.email, 'lee@example.com');
  assert.equal(reg.body.user.role, 'user');
  assert.equal((await c.get('/api/auth/me')).body.user.name, 'Lee');
  assert.equal((await c.post('/api/auth/register', { email: 'lee@example.com', password: 'another-pass', name: 'Lee 2' })).status, 409);
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/auth/me')).body.user, null);
  // the raw token is never stored
  const { rows } = await db.query('select token_hash from sessions');
  assert.ok(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash)));
});

test('login rejects wrong passwords; state-changing requests need the CSRF header', async () => {
  const c = client();
  assert.equal((await c.post('/api/auth/login', { email: 'lee@example.com', password: 'wrong-password' })).status, 401);
  assert.equal((await c.post('/api/auth/login', { email: 'lee@example.com', password: 'learner-pass-1' }, { csrf: false })).status, 403);
  assert.equal((await c.post('/api/auth/login', { email: 'lee@example.com', password: 'learner-pass-1' })).status, 200);
});

test('learners cannot use admin routes; admins can', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/admin/overview')).status, 401);
  assert.equal((await anon.get('/api/learn/lessons')).status, 401);
  const learner = client();
  await learner.post('/api/auth/login', { email: 'lee@example.com', password: 'learner-pass-1' });
  assert.equal((await learner.get('/api/admin/overview')).status, 403);
  const admin = client();
  const login = await admin.post('/api/auth/login', { email: 'admin@example.com', password: 'admin-pass-123' });
  assert.equal(login.body.user.role, 'admin');
  const o = await admin.get('/api/admin/overview');
  assert.equal(o.status, 200);
  assert.ok(o.body.users.admins >= 1);
});

test('starter course is built only from real signs', async () => {
  const plan = buildLessonPlan(await getGestures(db));
  assert.ok(plan.length >= 14);
  assert.ok(plan.every((l) => l.signs.length >= 4 && l.signs.length <= 11));
  const ids = plan.flatMap((l) => l.signs.map((g) => g.id));
  assert.equal(new Set(ids).size, ids.length); // no sign taught twice
  assert.ok(plan.flatMap((l) => l.signs).every((g) => ['curated', 'asl-lex', 'authored'].includes(g.source)));
});

test('learning: study, take a server-graded test, progress and report update', async () => {
  const c = client();
  await c.post('/api/auth/login', { email: 'lee@example.com', password: 'learner-pass-1' });
  const { body } = await c.get('/api/learn/lessons');
  const lesson = body.lessons[0];
  assert.ok(lesson.total > 0);
  const detail = (await c.get(`/api/learn/lessons/${lesson.id}`)).body;
  for (const s of detail.signs) assert.equal((await c.post(`/api/learn/signs/${s.id}/studied`, { lessonId: lesson.id })).status, 200);

  const t = await c.post('/api/learn/tests', { lessonId: lesson.id });
  assert.equal(t.status, 201);
  // the answer key never reaches the client
  const raw = JSON.stringify(t.body.questions);
  assert.ok(!raw.includes('"answer"') && !raw.includes('gestureId'));
  for (const q of t.body.questions.filter((x) => x.type === 'recognize')) assert.ok(q.signForm && !q.gloss);

  // Answer every question correctly using the stored key (as a perfect learner would).
  const stored = (await db.query('select questions from test_attempts where id=$1', [t.body.id])).rows[0].questions;
  const sub = await c.post(`/api/learn/tests/${t.body.id}/submit`, { answers: stored.map((q) => q.key.answer) });
  assert.equal(sub.body.score, sub.body.total);
  assert.equal(sub.body.passed, true);
  assert.equal((await c.post(`/api/learn/tests/${t.body.id}/submit`, { answers: [] })).status, 409); // no resubmitting

  const after = (await c.get('/api/learn/lessons')).body.lessons.find((l) => l.id === lesson.id);
  assert.equal(after.completed, true);
  const report = (await c.get('/api/learn/report')).body;
  assert.equal(report.tests.length, 1);
  assert.ok(report.totals.studied >= sub.body.total);
  assert.equal(report.totals.accuracy, 1);
  assert.equal(report.totals.streak, 1);

  // Answering one question at a time gives immediate, final feedback.
  const t2 = await c.post('/api/learn/tests', { lessonId: lesson.id });
  const key2 = (await db.query('select questions from test_attempts where id=$1', [t2.body.id])).rows[0].questions;
  const a0 = await c.post(`/api/learn/tests/${t2.body.id}/answer`, { index: 0, choice: key2[0].key.answer });
  assert.equal(a0.body.correct, true);
  assert.ok(a0.body.gloss);
  assert.equal((await c.post(`/api/learn/tests/${t2.body.id}/answer`, { index: 0, choice: 0 })).status, 409);
  const fin = await c.post(`/api/learn/tests/${t2.body.id}/submit`, { answers: key2.map(() => -5) });
  assert.equal(fin.body.results[0].correct, true);               // the locked answer counts, not the later body
  assert.equal(fin.body.score, 1);

  // A review test works once signs have been studied; answering wrong is graded wrong.
  const rv = await c.post('/api/learn/tests', { kind: 'review' });
  assert.equal(rv.status, 201);
  const rvKey = (await db.query('select questions from test_attempts where id=$1', [rv.body.id])).rows[0].questions;
  const wrong = rvKey.map((q) => (q.key.answer + 1) % q.public.options.length);
  const graded = await c.post(`/api/learn/tests/${rv.body.id}/submit`, { answers: wrong });
  assert.equal(graded.body.score, 0);
  assert.ok((await c.get('/api/learn/report')).body.weakest.length > 0);
});

test('feedback: learner sends (incl. about a sign), admin reads, replies and resolves', async () => {
  const learner = client();
  await learner.post('/api/auth/login', { email: 'lee@example.com', password: 'learner-pass-1' });
  const water = (await db.query("select id from gestures where gloss='WATER'")).rows[0];
  assert.equal((await learner.post('/api/feedback', { category: 'nope', message: 'hi there' })).status, 400);
  const f = await learner.post('/api/feedback', { category: 'sign-accuracy', message: 'The handshape looks off.', rating: 4, gestureId: water.id });
  assert.equal(f.status, 201);
  assert.equal(f.body.feedback.gloss, 'WATER');

  const admin = client();
  await admin.post('/api/auth/login', { email: 'admin@example.com', password: 'admin-pass-123' });
  const list = (await admin.get('/api/admin/feedback')).body.feedback;
  assert.equal(list[0].user.name, 'Lee');
  await admin.patch(`/api/admin/feedback/${list[0].id}`, { status: 'resolved', adminReply: 'Thanks — fixed.' });
  const mine = (await learner.get('/api/feedback/mine')).body.feedback[0];
  assert.equal(mine.status, 'resolved');
  assert.equal(mine.adminReply, 'Thanks — fixed.');
  const reported = (await admin.get('/api/admin/overview')).body.reported;
  assert.equal(reported[0].gloss, 'WATER');
});

test('admin manages signs: create, edit, review, delete; every change is audited', async () => {
  const admin = client();
  await admin.post('/api/auth/login', { email: 'admin@example.com', password: 'admin-pass-123' });
  const bad = await admin.post('/api/admin/signs', { gloss: 'TEST SIGN', meaning: 'x', signForm: [{ H: { right: 'NOPE' } }] });
  assert.equal(bad.status, 400);
  const created = await admin.post('/api/admin/signs', {
    gloss: 'Test sign', meaning: 'A sign made in the test.', pos: 'noun', english: 'test sign',
    keywords: [{ keyword: 'trial sign', weight: 0.8 }],
    signForm: [{ H: { right: 'HX_5' }, L: 'L01', M: { right: 'MX_STRAIGHT' } }, { L: 'L02' }],
  });
  assert.equal(created.status, 201);
  const s = created.body.sign;
  assert.equal(s.gloss, 'TEST SIGN');
  assert.equal(s.source, 'admin');
  assert.deepEqual(s.keywords.map((k) => k.keyword).sort(), ['test sign', 'trial sign']);
  // visible in the public vocabulary immediately (cache invalidated)
  assert.ok((await (await fetch(base + '/api/gestures')).json()).gestures.some((g) => g.gloss === 'TEST SIGN'));

  const edited = await admin.put(`/api/admin/signs/${s.id}`, { ...s, meaning: 'Edited meaning.', keywords: s.keywords });
  assert.equal(edited.body.sign.meaning, 'Edited meaning.');
  await admin.post(`/api/admin/signs/${s.id}/review`, { reviewed: true });
  assert.equal((await db.query('select needs_review from gestures where id=$1', [s.id])).rows[0].needs_review, false);

  // deleting a seed sign keeps it deleted across a seed upgrade; admin signs survive upgrades
  const tree = (await db.query("select id from gestures where gloss='TREE'")).rows[0];
  await admin.del(`/api/admin/signs/${tree.id}`);
  await db.query("update seed_meta set value='old' where key='version'");
  await seedIfEmpty(db);
  const glosses = (await getGestures(db)).map((g) => g.gloss);
  assert.ok(!glosses.includes('TREE'));
  assert.ok(glosses.includes('TEST SIGN'));

  const actions = (await admin.get('/api/admin/audit')).body.entries.map((e) => e.action);
  for (const a of ['sign.create', 'sign.update', 'sign.review', 'sign.delete']) assert.ok(actions.includes(a), a);
});

test('admin manages users and settings, with safety rails', async () => {
  const admin = client();
  const me = (await admin.post('/api/auth/login', { email: 'admin@example.com', password: 'admin-pass-123' })).body.user;
  assert.equal((await admin.patch(`/api/admin/users/${me.id}`, { role: 'user' })).status, 400); // cannot demote yourself
  const u = await admin.post('/api/admin/users', { email: 'sam@example.com', password: 'sam-pass-123', name: 'Sam', role: 'user' });
  assert.equal(u.status, 201);
  await admin.patch(`/api/admin/users/${u.body.user.id}`, { disabled: true });
  const sam = client();
  assert.equal((await sam.post('/api/auth/login', { email: 'sam@example.com', password: 'sam-pass-123' })).status, 403);

  assert.equal((await admin.put('/api/admin/settings', { siteTitle: '' })).status, 400);
  assert.equal((await admin.put('/api/admin/settings', { bogus: 1 })).status, 400);
  await admin.put('/api/admin/settings', { siteTitle: 'SignSense Academy', registrationOpen: false, announcement: 'Welcome!' });
  const pub = (await (await fetch(base + '/api/settings')).json()).settings;
  assert.equal(pub.siteTitle, 'SignSense Academy');
  assert.equal(pub.announcement, 'Welcome!');
  const blocked = await client().post('/api/auth/register', { email: 'new@example.com', password: 'new-pass-123', name: 'New' });
  assert.equal(blocked.status, 403);
  await admin.put('/api/admin/settings', { registrationOpen: true });
});

test('learning engine: Leitner boxes, grading and streaks', () => {
  assert.equal(nextBox(0, true), 1);
  assert.equal(nextBox(5, true), 5);
  assert.equal(nextBox(4, false), 1);
  const now = new Date('2026-10-19T12:00:00Z');
  assert.equal(streakDays([now, new Date('2026-10-18T09:00:00Z'), new Date('2026-10-17T09:00:00Z')], now), 3);
  assert.equal(streakDays([new Date('2026-10-15T09:00:00Z')], now), 0);
  const g = (id, gloss, hand, loc) => ({ id, gloss, english: gloss.toLowerCase(), signForm: [{ H: { right: hand, left: null }, L: loc, M: { right: null, left: null } }] });
  const signs = [g(1, 'A', 'HX_5', 'L01'), g(2, 'B', 'HX_S', 'L02'), g(3, 'C', 'HX_1', 'L03'), g(4, 'D', 'HX_O', 'L04'), g(5, 'E', 'HX_A', 'L05')];
  const hands = ['HX_5', 'HX_S', 'HX_1', 'HX_O', 'HX_A'].map((id) => ({ id, label: id, shape: {} }));
  const { questions } = buildTest(signs, { lessonPool: signs, pool: signs, hands, rng: () => 0.3 });
  assert.equal(questions.length, 5);
  for (const q of questions) {
    assert.ok(q.key.answer >= 0 && q.key.answer < q.public.options.length);
    if (q.public.type !== 'handshape') assert.equal(new Set(q.public.options.map((o) => JSON.stringify(o))).size, q.public.options.length);
  }
  const graded = gradeTest(questions, questions.map((q, i) => (i === 0 ? -1 : q.key.answer)));
  assert.equal(graded.score, 4);
  assert.equal(graded.results[0].correct, false);
});
