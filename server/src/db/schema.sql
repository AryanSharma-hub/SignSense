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
