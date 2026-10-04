import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// In-memory embedded Postgres; a fake Anthropic key so the AI routes are "configured".
process.env.PGLITE_DIR = ':memory:';
process.env.ANTHROPIC_API_KEY = 'test-key';
delete process.env.DATABASE_URL;
delete process.env.STT_API_KEY;

const { createDb } = await import('../src/db/adapter.js');
const { migrate, seedIfEmpty } = await import('../src/db/seed.js');
const { createApp } = await import('../src/app.js');
const { getGestures } = await import('../src/db/queries.js');
const seed = await import('../src/db/seedData.js');

let db, server, base;
const realFetch = globalThis.fetch;

before(async () => {
  db = await createDb();
  await migrate(db);
  await seedIfEmpty(db);
  server = createApp(db).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.close(); globalThis.fetch = realFetch; });

const get = async (p) => (await realFetch(base + p)).json();
const post = (p, body) => realFetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('schema + seed: every table populated and every row flagged needs_review', async () => {
  const p = await get('/api/parameters');
  assert.equal(p.locations.length, seed.locations.length);       // the new fifth parameter
  assert.equal(p.hands.length, seed.hands.length);
  for (const table of Object.values(p)) assert.ok(table.every((r) => r.needsReview === true));
  const { gestures } = await get('/api/gestures');
  assert.equal(gestures.length, seed.gestures.length);
  assert.ok(gestures.every((g) => g.needsReview === true));
});

test('gestures come back in the step-object shape, ordered, with keywords', async () => {
  const { gestures } = await get('/api/gestures');
  const mother = gestures.find((g) => g.gloss === 'MOTHER'), father = gestures.find((g) => g.gloss === 'FATHER');
  assert.equal(mother.signForm[0].L, 'L04');                      // chin
  assert.equal(father.signForm[0].L, 'L02');                      // forehead
  assert.deepEqual(mother.signForm[0].H, father.signForm[0].H);   // same handshape: location is the only difference
  assert.deepEqual(Object.keys(mother.signForm[0]).sort(), ['E', 'H', 'HD', 'L', 'M', 'joined', 'together']);
  assert.ok(mother.keywords.some((k) => k.keyword === 'mom'));
  const help = gestures.find((g) => g.gloss === 'HELP');
  assert.equal(help.signForm[0].joined, false);                   // fist on palm = independent hands
  const please = gestures.find((g) => g.gloss === 'PLEASE');
  assert.equal(please.signForm[0].joined, true);
});

test('ASL-LEX-derived gestures carry real handshape/location categories, not the hash-based placeholder ones', async () => {
  const { gestures } = await get('/api/gestures');
  for (const gloss of ['TREE', 'MONKEY', 'CHAIR']) {
    const g = gestures.find((x) => x.gloss === gloss);
    assert.ok(g, `${gloss} should exist (from ASL-LEX)`);
    assert.equal(g.needsReview, true);
    const step = g.signForm[0];
    assert.match(step.H.right, /^HX_/);                            // a real ASL-LEX handshape id, not H14-H35 placeholder
  }
  // the curated 16 and the explicit test-sensitive exclusions are never overridden/recreated
  assert.equal(gestures.find((g) => g.gloss === 'WATER').signForm[0].H.right, 'H11');
  assert.ok(!gestures.find((g) => g.gloss === 'SANDWICH'));
  assert.ok(!gestures.find((g) => g.gloss === 'BATHROOM'));
  // no duplicate gloss between any source (curated / ASL-LEX / placeholder)
  const glosses = gestures.map((g) => g.gloss);
  assert.equal(new Set(glosses).size, glosses.length);
});

test('an explicit "together" pairing on a step round-trips through seed -> DB -> API', async () => {
  const { gestures } = await get('/api/gestures');
  const hello = gestures.find((g) => g.gloss === 'HELLO');
  assert.deepEqual(hello.signForm[0].together, [['H', 'L']]);
  // every other step defaults to no pairing
  assert.deepEqual(hello.signForm[1].together, []);
});

test('single gesture lookup and 404', async () => {
  assert.equal((await get('/api/gestures/water')).gloss, 'WATER');
  assert.equal((await realFetch(base + '/api/gestures/nope')).status, 404);
});

test('seeding is idempotent and never overwrites admin edits unless forced', async () => {
  await db.query("update gestures set meaning='EDITED BY ADMIN' where gloss='WATER'");
  const again = await seedIfEmpty(db);
  assert.equal(again.seeded, false);
  assert.equal((await getGestures(db)).find((g) => g.gloss === 'WATER').meaning, 'EDITED BY ADMIN');
  await seedIfEmpty(db, { force: true });
  const gs = await getGestures(db);
  assert.equal(gs.length, seed.gestures.length);                  // no duplicates after re-seeding
  assert.notEqual(gs.find((g) => g.gloss === 'WATER').meaning, 'EDITED BY ADMIN');
});

test('/api/config advertises flags but never keys', async () => {
  const c = await get('/api/config');
  assert.deepEqual(c, { ai: { sentence: true, concepts: true }, stt: { server: false } });
});

test('AI sentence route proxies the LLM and validates input', async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.anthropic.com')) {
      const body = JSON.parse(init.body);
      assert.equal(init.headers['x-api-key'], 'test-key');
      assert.match(body.messages[0].content, /WANT/);
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '"I would like some water."' }] }) };
    }
    return realFetch(url, init);
  };
  const res = await post('/api/ai/sentence', { words: [{ gloss: 'WANT' }, { gloss: 'WATER' }], marker: 'statement' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: 'I would like some water.' });
  assert.equal((await post('/api/ai/sentence', { words: [] })).status, 400);
});

test('AI concepts route sends the DB vocabulary, parses JSON, drops junk', async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.anthropic.com')) {
      const body = JSON.parse(init.body);
      assert.match(body.messages[0].content, /thank you/);         // vocabulary is read server-side from the DB
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Sure!\n```json\n{"concepts":["Want","water",42,"  "]}\n```' }] }) };
    }
    return realFetch(url, init);
  };
  const res = await post('/api/ai/concepts', { transcript: "I'd like some water" });
  assert.deepEqual(await res.json(), { concepts: ['want', 'water'] });
  assert.equal((await post('/api/ai/concepts', { transcript: '   ' })).status, 400);
});

test('AI upstream failure surfaces as 502 (the client then falls back to the deterministic tier)', async () => {
  globalThis.fetch = async (url, init) => (String(url).startsWith('https://api.anthropic.com') ? { ok: false, status: 529 } : realFetch(url, init));
  assert.equal((await post('/api/ai/sentence', { words: [{ gloss: 'HELP' }] })).status, 502);
});

test('server STT is cleanly unavailable when not configured', async () => {
  globalThis.fetch = realFetch;
  const res = await realFetch(base + '/api/stt', { method: 'POST', headers: { 'content-type': 'audio/webm' }, body: Buffer.alloc(2000, 1) });
  assert.equal(res.status, 503);
});
