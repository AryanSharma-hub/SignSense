-- SignSense schema (Postgres). Idempotent: safe to run on every start.
--
-- Every vocabulary row carries needs_review (default true). Seed data is a DRAFT
-- scaffold; a row should only be flipped to false once an ASL-fluent reviewer has
-- checked it against a real reference. See README "Data accuracy".

create table if not exists expressions (
  id            text primary key,
  label         text not null,
  glyph         text,
  family        text not null,
  needs_review  boolean not null default true
);

create table if not exists hands (
  id            text primary key,
  label         text not null,
  glyph         text,
  family        text not null,
  both_handed   boolean not null default false,
  -- renderer geometry: {"curl":[thumb,index,middle,ring,pinky] (0 extended..1 curled),
  --                     "spread":0..1, "thumbAngle":optional degrees}
  shape         jsonb,
  needs_review  boolean not null default true
);

create table if not exists movements (
  id            text primary key,
  label         text not null,
  dir           text not null,              -- compass value | 'CENTER' | 'PATTERN'
  family        text not null,
  needs_review  boolean not null default true
);

create table if not exists heads (
  id            text primary key,
  label         text not null,
  glyph         text,
  family        text not null,
  rotation_deg  integer not null default 0,
  drag_dir      text,                       -- compass value or null
  motion        text,                       -- 'nod' | 'shake' | null (renderer animation)
  needs_review  boolean not null default true
);

-- NEW in v4: the fifth phonological parameter (where the sign is made).
create table if not exists locations (
  id            text primary key,
  label         text not null,
  body_region   text not null,
  anchor_x      real not null,              -- anchor in the 240x300 signer viewBox
  anchor_y      real not null,
  family        text not null,
  needs_review  boolean not null default true
);

create table if not exists gestures (
  id            serial primary key,
  gloss         text not null unique,
  meaning       text not null,
  pos           text,                       -- pronoun | verb | noun | adj | adv | interj  (sentence assembly)
  english       text,                       -- surface form used by the deterministic assembler
  needs_review  boolean not null default true
);

create table if not exists gesture_steps (
  id                 serial primary key,
  gesture_id         integer not null references gestures(id) on delete cascade,
  step_order         integer not null,
  expression_id      text references expressions(id),
  head_id            text references heads(id),
  hand_right_id      text references hands(id),
  hand_left_id       text references hands(id),
  movement_right_id  text references movements(id),
  movement_left_id   text references movements(id),
  location_id        text references locations(id),   -- nullable: null = neutral/chest default
  joined             boolean not null default false,
  -- Explicit author-time pairing of two parameters in this step as a deliberate
  -- simultaneous unit (distinct from `joined`, which is only ever derived from
  -- two-palm handshapes). Shape: array of 2-element arrays of parameter keys
  -- ("E","H","M","HD","L"), each pair alphabetically sorted, e.g. [["H","L"]].
  together           jsonb not null default '[]',
  unique (gesture_id, step_order)
);

create table if not exists gesture_keywords (
  id          serial primary key,
  gesture_id  integer not null references gestures(id) on delete cascade,
  keyword     text not null,               -- lowercase; may be multi-word ("thank you", "would like")
  weight      real not null default 1,     -- 0..1 confidence that this keyword means this sign
  unique (gesture_id, keyword)
);

create index if not exists gesture_keywords_keyword_idx on gesture_keywords (keyword);

-- v5: provenance for every sign, and safe seed upgrades.
--   source        'curated' | 'asl-lex' | 'authored'  (see seedData/index.js)
--   source_ref    ASL-LEX 2.0 sign code for curated/asl-lex signs
--   frequency     ASL-LEX sign frequency (1-7: how familiar signers rate the sign), when known
--   seed_checksum fingerprint of the row as last seeded; a row whose current content no
--                 longer matches it was edited by an admin and is never overwritten by an upgrade
alter table gestures add column if not exists source text;
alter table gestures add column if not exists source_ref text;
alter table gestures add column if not exists frequency real;
alter table gestures add column if not exists seed_checksum text;

create table if not exists seed_meta (
  key    text primary key,
  value  text not null
);

-- ============================================================================
-- v6: accounts, learning, feedback, admin.
-- ============================================================================

-- Who created / reviewed a sign. source 'admin' = created in the admin dashboard; such rows
-- are never removed by a seed upgrade. reviewed_* records an admin's review (needs_review=false).
alter table gestures add column if not exists reviewed_by integer;
alter table gestures add column if not exists reviewed_at timestamptz;
alter table gestures add column if not exists updated_at timestamptz;

-- Seed signs an admin deleted: a seed upgrade must not bring them back.
create table if not exists deleted_signs (
  gloss       text primary key,
  deleted_at  timestamptz not null default now()
);

create table if not exists users (
  id             serial primary key,
  email          text not null unique,             -- stored lowercase
  name           text not null,
  password_hash  text not null,                    -- scrypt$N$r$p$salt$hash
  role           text not null default 'user' check (role in ('user', 'admin')),
  disabled       boolean not null default false,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

create table if not exists sessions (
  token_hash  text primary key,                    -- sha256 of the cookie token; the token itself is never stored
  user_id     integer not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists lessons (
  id           serial primary key,
  slug         text not null unique,
  unit         text not null,                      -- grouping shown on the Learn page
  title        text not null,
  description  text not null default '',
  level        text not null default 'beginner',
  position     integer not null default 0,
  published    boolean not null default true
);

create table if not exists lesson_signs (
  lesson_id   integer not null references lessons(id) on delete cascade,
  gesture_id  integer not null references gestures(id) on delete cascade,
  position    integer not null default 0,
  primary key (lesson_id, gesture_id)
);

-- Spaced repetition (Leitner boxes 0-5) per user and sign.
create table if not exists sign_progress (
  user_id         integer not null references users(id) on delete cascade,
  gesture_id      integer not null references gestures(id) on delete cascade,
  box             smallint not null default 0,
  correct         integer not null default 0,
  wrong           integer not null default 0,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  next_review_at  timestamptz not null default now(),
  primary key (user_id, gesture_id)
);

create table if not exists lesson_progress (
  user_id       integer not null references users(id) on delete cascade,
  lesson_id     integer not null references lessons(id) on delete cascade,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,                      -- first test passed (>= 80%)
  best_score    real,                             -- 0..1
  primary key (user_id, lesson_id)
);

-- A test: questions are generated and graded on the server; `questions` holds the answer key.
create table if not exists test_attempts (
  id           serial primary key,
  user_id      integer not null references users(id) on delete cascade,
  lesson_id    integer references lessons(id) on delete set null,
  kind         text not null check (kind in ('lesson', 'review')),
  questions    jsonb not null,
  answers      jsonb,
  score        integer,
  total        integer not null,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists test_attempts_user_idx on test_attempts (user_id, created_at);

create table if not exists feedback (
  id           serial primary key,
  user_id      integer references users(id) on delete set null,
  gesture_id   integer references gestures(id) on delete set null,
  gloss        text,                              -- kept even if the sign is later deleted
  category     text not null check (category in ('sign-accuracy', 'lesson', 'bug', 'suggestion', 'other')),
  rating       smallint check (rating between 1 and 5),
  message      text not null,
  page         text,
  status       text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists site_settings (
  key    text primary key,
  value  jsonb not null
);

create table if not exists audit_log (
  id          serial primary key,
  user_id     integer references users(id) on delete set null,
  action      text not null,
  target      text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
