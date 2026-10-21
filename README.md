# SignSense

A two-way communication aid between a **signer** and a **hearing person**.

- **Direction A — sign → speech.** The signer builds a sign by direct manipulation on an on-screen figure
  (drag a hand to set its movement, tap the face for an expression, tap a hand for a handshape, tap the body for a
  location). Live suggestions find matching signs; chosen signs become a sentence that is assembled into English and spoken.
- **Direction B — speech → sign.** The hearing person speaks or types. The app works out the sentence type and the
  key concepts, maps them to signs, and the **same signer figure performs them**. Words that have no sign are shown
  explicitly, never dropped silently.
- **One conversation transcript** holds both directions, and any message can be replayed.

> ## ⚠️ Data accuracy — please read
> **2,310 American Sign Language signs, every one traceable to a source.** 2,299 take their handshapes, hands used,
> movement shape and repetition, start/end locations and handshape change from **ASL-LEX 2.0** (a published lexical
> database of ASL), and `npm run seed:validate -w server` re-derives each of them from its ASL-LEX row and fails on any
> mismatch. 11 very common signs ASL-LEX lacks are **authored** from standard ASL descriptions and labelled as such in
> the UI. There are no placeholder or invented signs: a word with no sign is fingerspelled (names, numbers) or shown as
> unsigned. See [`server/src/db/VOCABULARY_REPORT.md`](server/src/db/VOCABULARY_REPORT.md) for the full verification
> report, everyday-word coverage (97% of a 433-word core list) and known limits.
>
> **Still not reviewed by a fluent signer.** ASL-LEX does not code movement direction, palm orientation or facial
> grammar, so those are approximated, and every row keeps `needs_review = true`. Do not rely on this for medical, legal
> or other important communication until a fluent (ideally Deaf) ASL user has reviewed it. Sentence-type → expression
> rules (question = raised brows, negation = headshake, …) live in one table, `client/src/lib/nonManual.js`.

## Quick start

Requires Node 20+ (developed on Node 22).

```bash
npm install
npm run dev          # API on :3001, web app on http://localhost:5173
```

That's it — no database to install. With no `DATABASE_URL`, the server uses **PGlite** (real Postgres compiled to
WASM, running in-process, persisted in `server/data/pgdata`). It creates the schema and seeds the vocabulary on first start, and upgrades it automatically when the shipped data changes.

Production:

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built client on one port
```

### Deploying on Render

The repository includes a Render Blueprint (`render.yaml`) for the Node web service. To deploy:

1. Create a free PostgreSQL database with a hosted provider such as Neon. Do not use the server's local PGlite
   database for a hosted deployment: Render's free web service has an ephemeral filesystem.
2. In Render, create a new Blueprint and connect this GitHub repository. Render builds the client and starts the
   API, which also serves the built client.
3. Set `DATABASE_URL` in the Render service environment to the hosted database connection string. Keep
   `DATABASE_SSL=true` for hosted databases requiring TLS.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (and optionally `ADMIN_NAME`) in the Render service environment to
   bootstrap the first administrator. Use a unique, strong password and keep it private.

The server creates/upgrades the schema and seeds the vocabulary and starter lessons at startup. Render's free web
service can spin down when idle, so the first request afterward may take about a minute. Free hosting is intended
for testing and hobby projects, not production.

### Accounts, learning and the admin dashboard

The translator needs no account. Learners create one to use the **learning module**: a course of short
lessons built from the verified everyday vocabulary, server-graded tests (watch a sign and name it, find
the sign for a word, pick the handshape) with instant feedback, spaced-repetition review, a progress
report (with CSV export) and a feedback page — including "report a problem" on any sign, which feeds
the admin review queue.

Create the first administrator (or set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`):

```bash
npm run admin:create -w server -- you@example.com "a-strong-password" "Your Name"
```

Everyone signs in at `/login`; administrators land on `/admin`, which covers: an overview (activity,
most-missed and most-reported signs, learner report), **Signs** (create / edit every field and step with
a live preview, mark reviewed, delete — or build a sign on the signer and choose "Save as new sign"),
**Lessons** (create, edit, reorder, publish, choose signs), **Feedback** (reply, set status), **Users**
(create, change role, disable, reset password, delete), **Site settings** (name, tagline, announcement
banner, registration, learning and feedback switches, pass mark, test length) and an **Activity log**
of every admin action. Safety rails: you cannot demote or delete yourself, and there is always at
least one active administrator.

Security: passwords are scrypt-hashed; sessions are random tokens in an HttpOnly, SameSite=Lax cookie
(only a SHA-256 of the token is stored; `Secure` in production); state-changing requests need an
`X-Requested-With` header (CSRF); sign-in and sign-up are rate-limited; test answer keys never leave the
server. Admin-created and admin-edited signs survive vocabulary upgrades, and seed signs an admin
deletes stay deleted.

### Using a real Postgres / Supabase

```bash
cp .env.example .env
# DATABASE_URL=postgres://user:password@host:5432/signsense
# DATABASE_SSL=true      # for hosted Postgres that requires TLS (e.g. Supabase)
npm run seed             # creates tables and loads (or upgrades) the vocabulary
```

The schema (`server/src/db/schema.sql`) is plain Postgres and idempotent. A routine restart never touches the data.
When the shipped seed changes, the next start upgrades the database: rows still exactly as last seeded are updated,
dropped signs are removed, and any row edited directly in the database since seeding (detected by its stored
fingerprint) is kept untouched and reported. `npm run seed:reset` overwrites everything with the seed.

```bash
npm run seed:validate -w server   # structure + cross-verification of every ASL-LEX sign against its source row
npm run seed:report -w server     # regenerate server/src/db/VOCABULARY_REPORT.md
```

### Adding vocabulary

Vocabulary is data, not code: add rows, no redeploy. Use the ASL-LEX handshape (`HX_…`), movement (`MX_…`) and location ids, mark the row's `source`, and have a fluent signer check it. Template:

```sql
insert into gestures (gloss, meaning, pos, english, source) values ('<GLOSS>', '<meaning>', 'noun', '<word>', 'authored') returning id;
insert into gesture_steps (gesture_id, step_order, hand_right_id, hand_left_id, location_id, movement_right_id)
  values (<id>, 0, '<HX_… handshape>', null, '<location id>', '<MX_… movement>');
insert into gesture_keywords (gesture_id, keyword, weight) values (<id>, '<word>', 1);
```

## Optional AI tiers (all off by default)

Everything works with no API keys. Three capabilities follow **one** pattern (`client/src/lib/tiered.js`): a deterministic,
offline-capable default tier plus an optional AI/network tier behind the same interface. If the optional tier is off,
unconfigured, or fails, the default answers automatically and the UI says so.

| Capability | Default tier (offline) | Optional tier |
|---|---|---|
| Sign → English sentence | rule-based assembler (`lib/sentenceAssembler`) | LLM via `POST /api/ai/sentence` |
| Speech → concepts | stopwords + lemma/stem + fuzzy match against `gesture_keywords` (`lib/speechToGloss`) | LLM via `POST /api/ai/concepts` |
| Speech → text | browser `SpeechRecognition` | server transcription via `POST /api/stt` |

Set keys in `.env` (see `.env.example`): `ANTHROPIC_API_KEY` (+ optional `LLM_MODEL`) and/or `STT_API_KEY`
(any OpenAI-compatible `/audio/transcriptions` endpoint via `STT_BASE_URL`). Keys stay on the server; the browser only
learns which tiers are available (`GET /api/config`) and the user turns each on under **Engines**. The AI routes are rate-limited.

## How it fits together

```
server/src
  db/         schema.sql · seedData.js (DRAFT) · adapter.js (pg or PGlite) · seed.js · queries.js
  routes/     vocabulary (parameters, gestures) · ai (sentence, concepts) · stt
client/src
  lib/
    playSignForm.js    THE playback sequencer — every playback (A, B, replay, previews) goes through it;
                       buildTimeline() lays a performance out as frames for stepping / scrubbing
    clock.js           pausable, speed-scaled clock (slow practice without changing the sequence)
    rig/               the signer's skeleton — pure and unit-tested:
      skeleton.js        proportions, joint limits, the ONE coordinate/handedness convention
      ik.js              two-bone IK with an elbow pole vector + shoulder lift; hand placed by FK from the wrist
      solveFigure.js     collision correction (hands vs face unless the sign is AT the head; hands vs each other
                         unless joined) and back-to-front draw order
      face.js            expressions as numeric face parameters, so the face eases between them
      draw.js            tapered-limb path helpers
    resolveHands.js    two-palm handshapes force both hands, enforced on every hand-read path
    steps.js pose.js   step model {E,HD,L,H:{right,left},M:{right,left}} and pose → animation targets
    nonManual.js       sentence type → expression + head marker
    search.js          weighted parallel search over 5 parameters
    tiered.js          the tiered-adapter pattern
    sentenceAssembler/ speechToGloss/ stt/
  hooks/      useComposer · useStagePlayer · useAnimatedPose · useReverseAssembler · useSpeechToText · …
  components/ SignerDummy (the avatar: animation hook -> rig -> SVG, plus body-part hit-areas) · avatar/ (Body, Head, Hand, Guides)
              Stage (avatar + PartInspector + PlaybackBar) · QueryBuilder (StepsBar + Precise controls) · Suggestions
              SentenceBuilder · Conversation · …
```

Workspace layout (≥1180px; stacks into one column below, avatar first):

```
 Suggestions   |        Signer (avatar)        | Conversation
 Query builder              |            Sentence builder
```

Design choices worth knowing:

- **The avatar is a solved skeleton, not a drawing per pose.** Every frame, the animated hand targets go through
  collision correction and two-bone IK (lib/rig); arms, wrists and hands are drawn from the solved joints, so the hand
  can never detach and the elbow always bends outward within anatomical limits. It is a 2.5D SVG rig rather than a
  WebGL model: it renders identically in the 30+ suggestion thumbnails, in jsdom tests and on low-end laptops, needs
  no 3D asset licence, and the sign data (2D anchors in a 240×300 space) maps onto it one-to-one. Palm orientation
  is not in the data, so it is not invented.
- **Every body part is a control.** Tap the face (expressions), hair (head movement), a hand (handshapes), an arm
  (movements) or the body (locations); the options open in the inspector beside the figure, never over it.
  Drag a hand or the face for movement. All of it is keyboard-operable.
- **Playback for learning**: pause / resume, step and word stepping, scrubbing, replay, 0.25×–1.25× speed (sign time,
  so motion and timing scale together), three camera framings, and a "Paths" overlay that draws the skeleton and each
  movement's path with an arrow at its end point. Signs with unreviewed data say so while they play.

- **Five phonological parameters**: expression, handshape, movement, head, and **location** (new). MOTHER and FATHER share
  everything except location (chin vs forehead), which is why location is a first-class, searchable parameter.
- **One performer.** Direction B produces the same `signForm` objects Direction A already renders; there is no second rendering path.
- **Grammar on the face.** Direction B classifies the hearing user's sentence (question / negation / imperative / statement)
  and layers the matching expression + head movement over the whole clause, mirroring how Direction A reads grammar from the signer's face.
- **Low confidence is never guessed at.** If speech recognition is unsure, nothing is signed; the hearing user is asked to retry or correct the text.
- **Accessible by default.** Every drag/tap interaction has a keyboard/screen-reader equivalent (arrow keys on the figure,
  and the collapsed **Precise controls** panel). Motion respects `prefers-reduced-motion`; the pose is always described in text.
- **Offline-tolerant.** The vocabulary is cached on the device, and the default tiers need no network.

## Tests

```bash
npm test     # client (Vitest, incl. a full-app integration test on the real seed data) + server (node:test)
```

## Known limitations / not built yet

- Every sign is source-checked against ASL-LEX (or labelled authored) but none is reviewed by a fluent signer yet; that review is the main next step. 13 core everyday words still have no sign (listed in the vocabulary report).
- Fingerspelling, numbers, regional variation and other sign languages are not modelled.
- Palm orientation and two-hand relative position beyond "joined / independent" are not modelled; the avatar keeps
  palms facing the viewer rather than guessing. Movements use the shared stroke / tap / shake / orbit primitives in
  `pose.js` driven by each sign's own direction data — they are approximations until per-sign motion data is reviewed.
- Speech → sign keeps English word order; AI reordering into topic-comment gloss order is a possible refinement.
- There is no admin UI — vocabulary is edited in the database.
- Recognition quality depends on the browser's engine; the optional server tier exists for browsers without one.
