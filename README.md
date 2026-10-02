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
> **The sign data in this repository is a draft scaffold, not verified ASL.** The handshapes, movements, locations and
> non-manual markers come from a prototype and exist to demonstrate the interaction model. Every row in every vocabulary
> table has a `needs_review` flag that defaults to `true`, and the UI shows a "Draft sign data" notice.
> **Do not rely on this for medical, legal or other important communication until an ASL-fluent reviewer has checked the
> data against a real reference** and flipped the flag. Sentence-type → expression rules (question = raised brows,
> negation = headshake, …) live in one table, `client/src/lib/nonManual.js`, so they are easy to correct.

## Quick start

Requires Node 20+ (developed on Node 22).

```bash
npm install
npm run dev          # API on :3001, web app on http://localhost:5173
```

That's it — no database to install. With no `DATABASE_URL`, the server uses **PGlite** (real Postgres compiled to
WASM, running in-process, persisted in `server/data/pgdata`). It creates the schema and seeds the draft vocabulary on first start.

Production:

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built client on one port
```

### Using a real Postgres / Supabase

```bash
cp .env.example .env
# DATABASE_URL=postgres://user:password@host:5432/signsense
# DATABASE_SSL=true      # for hosted Postgres that requires TLS (e.g. Supabase)
npm run seed             # creates tables and loads the draft vocabulary if empty
```

The schema (`server/src/db/schema.sql`) is plain Postgres and idempotent. Seeding only runs when the `gestures` table is
empty, so edits made directly in the database are never overwritten on restart. `npm run seed:reset` re-applies the seed
over existing rows.

### Adding vocabulary

Vocabulary is data, not code: add rows, no redeploy. Example — a new sign with keywords:

```sql
insert into gestures (gloss, meaning, pos, english) values ('HUNGRY', 'Feeling the need to eat', 'adj', 'hungry') returning id;
insert into gesture_steps (gesture_id, step_order, expression_id, hand_right_id, location_id, movement_right_id)
  values (<id>, 0, 'E01', 'H03', 'L01', 'M01');
insert into gesture_keywords (gesture_id, keyword, weight) values (<id>, 'hungry', 1), (<id>, 'starving', 0.6);
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
    playSignForm.js    THE playback sequencer — every playback (A, B, replay, previews) goes through it
    resolveHands.js    two-palm handshapes force both hands, enforced on every hand-read path
    steps.js pose.js   step model {E,HD,L,H:{right,left},M:{right,left}} and pose → animation targets
    nonManual.js       sentence type → expression + head marker
    search.js          weighted parallel search over 5 parameters
    tiered.js          the tiered-adapter pattern
    sentenceAssembler/ speechToGloss/ stt/
  hooks/      useComposer · useStagePlayer · useAnimatedPose · useReverseAssembler · useSpeechToText · …
  components/ SignerDummy (parametric SVG figure) · Stage · StepsBar · Suggestions · SentenceBuilder · Conversation · …
```

Design choices worth knowing:

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

- Vocabulary is 16 draft signs. Growing and verifying it (with a reviewer, ideally a Deaf ASL user) is the main next step.
- Fingerspelling, numbers, regional variation and other sign languages are not modelled.
- Palm orientation and two-hand relative position beyond "joined / independent" are not modelled.
- Speech → sign keeps English word order; AI reordering into topic-comment gloss order is a possible refinement.
- There is no admin UI — vocabulary is edited in the database.
- Recognition quality depends on the browser's engine; the optional server tier exists for browsers without one.
