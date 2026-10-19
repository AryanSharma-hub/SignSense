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
const { validateSeed, crossVerify } = await import('../src/db/validateSeed.js');
const seed = await import('../src/db/seedData.js');

let db, server, base;
const realFetch = globalThis.fetch;

before(async () => {
  db = await createDb();
  await migrate(db);
  await seedIfEmpty(db);
  server = createApp(db).listen(0);
  // Some tests below run for several seconds; keep the client's pooled socket valid across them.
  server.keepAliveTimeout = 60_000;
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.close(); globalThis.fetch = realFetch; });

const get = async (p) => (await realFetch(base + p)).json();
const post = (p, body) => realFetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'SignSense' }, body: JSON.stringify(body) });

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
  assert.deepEqual(help.signForm[0].H, { right: 'HX_A', left: 'HX_FLAT_B' });
  const more = gestures.find((g) => g.gloss === 'MORE');
  assert.equal(more.signForm[0].joined, true);                    // both O-hands, same shape
  const please = gestures.find((g) => g.gloss === 'PLEASE');
  assert.equal(please.signForm[0].H.left, null);                  // PLEASE is one-handed in ASL
});

test('every sign is traceable to a real source and matches its ASL-LEX coding', async () => {
  const { gestures } = await get('/api/gestures');
  assert.deepEqual(validateSeed(), []);
  const { checked, mismatches } = crossVerify();
  assert.ok(checked > 2000);
  assert.deepEqual(mismatches, []);
  // provenance reaches the API; no placeholder (hash-generated) source exists any more
  for (const g of gestures) assert.ok(['curated', 'asl-lex', 'authored'].includes(g.source), `${g.gloss}: ${g.source}`);
  for (const gloss of ['TREE', 'MONKEY', 'CHAIR', 'WHERE', 'BATHROOM', 'SANDWICH', 'DRINK', 'HUNGRY', 'NEED']) {
    const g = gestures.find((x) => x.gloss === gloss);
    assert.ok(g, `${gloss} should exist (from ASL-LEX)`);
    assert.equal(g.source, 'asl-lex');
    assert.match(g.sourceRef, /^[A-Z]_\d{2}_\d{3}$/);
    assert.equal(g.needsReview, true);
    assert.match(g.signForm[0].H.right, /^HX_/);
  }
  // curated signs are built from ASL-LEX too: WATER is a W-hand tapping the chin
  const water = gestures.find((g) => g.gloss === 'WATER');
  assert.equal(water.source, 'curated');
  assert.deepEqual([water.signForm[0].H.right, water.signForm[0].L, water.signForm[0].M.right], ['HX_W', 'L04', 'MX_STRAIGHT_REP']);
  // a different meaning of the same English word is its own sign, ranked below the common one
  const fall = gestures.find((g) => g.gloss === 'FALL'), fallVerb = gestures.find((g) => g.gloss === 'FALL (verb)');
  assert.ok(fall && fallVerb);
  assert.ok(fall.keywords[0].weight > fallVerb.keywords[0].weight);
  // a sign that travels keeps its end location: THANK YOU moves out from the mouth
  const thanks = gestures.find((g) => g.gloss === 'THANK YOU');
  assert.deepEqual(thanks.signForm.map((s) => s.L), ['L03', 'LX_HEADAWAY']);
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

test('upgrading an older database replaces stale seed rows but keeps admin edits', async () => {
  // Simulate a pre-upgrade database: an old placeholder sign, a stale version, and an admin edit.
  await db.query("insert into hands (id,label,family) values ('H99','Old placeholder','extra')");
  const { rows } = await db.query("insert into gestures (gloss,meaning) values ('ZZPLACEHOLDER','Old.') returning id");
  await db.query("insert into gesture_steps (gesture_id,step_order,hand_right_id) values ($1,0,'H99')", [rows[0].id]);
  await db.query("update gestures set meaning='EDITED BY ADMIN' where gloss='MOTHER'");
  await db.query("update seed_meta set value='old' where key='version'");

  const res = await seedIfEmpty(db);
  assert.equal(res.upgraded, true);
  assert.deepEqual(res.kept, ['MOTHER']);
  const gs = await getGestures(db);
  assert.ok(!gs.find((g) => g.gloss === 'ZZPLACEHOLDER'));          // seed-owned stale row removed
  assert.equal(gs.find((g) => g.gloss === 'MOTHER').meaning, 'EDITED BY ADMIN');
  assert.equal((await db.query("select count(*)::int n from hands where id='H99'")).rows[0].n, 0); // unreferenced param pruned
  assert.equal((await seedIfEmpty(db)).seeded, false);             // and now it is current
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
  const res = await realFetch(base + '/api/stt', { method: 'POST', headers: { 'content-type': 'audio/webm', 'x-requested-with': 'SignSense' }, body: Buffer.alloc(2000, 1) });
  assert.equal(res.status, 503);
});
