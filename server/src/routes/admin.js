import { Router } from 'express';
import {
  requireAdmin, audit, hashPassword, validateCredentials, publicUser, destroyUserSessions,
} from '../auth/index.js';
import { getGesturesCached, invalidateGestures } from '../db/queries.js';
import { getSettings, validateSettings, saveSettings, SETTINGS } from '../settings.js';
import { validateSign, writeSign } from '../admin/signs.js';
import { feedbackRow, FEEDBACK_CATEGORIES } from './feedback.js';
import { LEARNED_BOX } from '../learn/engine.js';

const asInt = (v) => (Number.isInteger(Number(v)) && v !== '' && v != null ? Number(v) : null);
const SEED_SOURCES = new Set(['curated', 'asl-lex', 'authored']);

export function adminRoutes(db) {
  const r = Router();
  r.use(requireAdmin);

  // ---------------------------------------------------------------- overview & reports
  r.get('/overview', async (_req, res) => {
    const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
    const users = await one("select count(*)::int total, count(*) filter (where role='admin')::int admins, count(*) filter (where disabled)::int disabled from users");
    const signs = (await db.query("select coalesce(source,'unknown') source, count(*)::int n, count(*) filter (where not needs_review)::int reviewed from gestures group by 1")).rows;
    const feedback = (await db.query('select status, count(*)::int n from feedback group by status')).rows;
    const learning = await one(
      `select (select count(*)::int from test_attempts where finished_at > now() - interval '30 days') tests30,
              (select count(distinct user_id)::int from sign_progress where last_seen_at > now() - interval '7 days') active7,
              (select count(*)::int from lessons) lessons,
              (select coalesce(avg(score::real / nullif(total,0)),0) from test_attempts where finished_at is not null) avg_score`);
    const perDay = (await db.query(
      `select to_char(date_trunc('day', finished_at), 'YYYY-MM-DD') as day, count(*)::int tests,
              avg(score::real / nullif(total,0)) as avg
         from test_attempts where finished_at > now() - interval '30 days' group by 1 order by 1`)).rows;
    const missed = (await db.query(
      `select g.id, g.gloss, sum(sp.wrong)::int wrong, sum(sp.correct)::int correct
         from sign_progress sp join gestures g on g.id = sp.gesture_id
        group by g.id having sum(sp.wrong + sp.correct) >= 3
        order by (sum(sp.wrong)::real / sum(sp.wrong + sp.correct)) desc limit 10`)).rows;
    const reported = (await db.query(
      `select coalesce(gloss, '(deleted sign)') gloss, gesture_id, count(*)::int n, count(*) filter (where status <> 'resolved')::int open
         from feedback where category = 'sign-accuracy' group by gloss, gesture_id order by open desc, n desc limit 10`)).rows;
    res.json({ users, signs, feedback, learning, perDay, missed, reported });
  });

  r.get('/reports/learners', async (_req, res) => {
    const { rows } = await db.query(
      `select u.id, u.name, u.email, u.role, u.created_at, u.last_login_at,
              (select count(*)::int from sign_progress sp where sp.user_id = u.id) studied,
              (select count(*)::int from sign_progress sp where sp.user_id = u.id and sp.box >= ${LEARNED_BOX}) learned,
              (select count(*)::int from lesson_progress lp where lp.user_id = u.id and lp.completed_at is not null) lessons_completed,
              (select count(*)::int from test_attempts t where t.user_id = u.id and t.finished_at is not null) tests,
              (select avg(score::real / nullif(total,0)) from test_attempts t where t.user_id = u.id and t.finished_at is not null) avg_score,
              greatest(u.last_login_at, (select max(last_seen_at) from sign_progress sp where sp.user_id = u.id)) last_active
         from users u order by last_active desc nulls last, u.created_at desc`);
    res.json({ learners: rows });
  });

  // ---------------------------------------------------------------- signs
  r.get('/signs', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const source = String(req.query.source || '');
    const review = String(req.query.review || ''); // 'reviewed' | 'unreviewed' | ''
    const page = Math.max(0, asInt(req.query.page) ?? 0), size = 50;
    let list = await getGesturesCached(db);
    if (q) list = list.filter((g) => g.gloss.toLowerCase().includes(q) || g.keywords.some((k) => k.keyword.includes(q)));
    if (source) list = list.filter((g) => (g.source || 'unknown') === source);
    if (review === 'reviewed') list = list.filter((g) => !g.needsReview);
    if (review === 'unreviewed') list = list.filter((g) => g.needsReview);
    if (q) list = [...list].sort((a, b) => Number(b.gloss.toLowerCase() === q) - Number(a.gloss.toLowerCase() === q) || a.gloss.localeCompare(b.gloss));
    res.json({ total: list.length, page, size, signs: list.slice(page * size, page * size + size) });
  });

  r.post('/signs', async (req, res) => {
    const v = await validateSign(db, req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const dup = await db.query('select 1 from gestures where gloss=$1', [v.sign.gloss]);
    if (dup.rows.length) return res.status(409).json({ error: `A sign called ${v.sign.gloss} already exists.` });
    const id = await writeSign(db, v.sign, { source: 'admin' });
    await db.query('delete from deleted_signs where gloss=$1', [v.sign.gloss]);
    invalidateGestures(db);
    await audit(db, req.user.id, 'sign.create', v.sign.gloss);
    res.status(201).json({ sign: (await getGesturesCached(db)).find((g) => g.id === id) });
  });

  r.put('/signs/:id', async (req, res) => {
    const id = asInt(req.params.id);
    const cur = (await db.query('select gloss from gestures where id=$1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Sign not found.' });
    const v = await validateSign(db, req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    if (v.sign.gloss !== cur.gloss) {
      const dup = await db.query('select 1 from gestures where gloss=$1', [v.sign.gloss]);
      if (dup.rows.length) return res.status(409).json({ error: `A sign called ${v.sign.gloss} already exists.` });
    }
    await writeSign(db, v.sign, { id });
    // An edited sign is no longer what was reviewed.
    await db.query('update gestures set needs_review=true, reviewed_by=null, reviewed_at=null where id=$1', [id]);
    invalidateGestures(db);
    await audit(db, req.user.id, 'sign.update', v.sign.gloss, cur.gloss !== v.sign.gloss ? { renamedFrom: cur.gloss } : null);
    res.json({ sign: (await getGesturesCached(db)).find((g) => g.id === id) });
  });

  r.post('/signs/:id/review', async (req, res) => {
    const id = asInt(req.params.id);
    const reviewed = req.body?.reviewed !== false;
    const { rows } = await db.query(
      'update gestures set needs_review=$1, reviewed_by=$2, reviewed_at=$3 where id=$4 returning gloss',
      [!reviewed, reviewed ? req.user.id : null, reviewed ? new Date() : null, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Sign not found.' });
    invalidateGestures(db);
    await audit(db, req.user.id, reviewed ? 'sign.review' : 'sign.unreview', rows[0].gloss);
    res.json({ ok: true });
  });

  r.delete('/signs/:id', async (req, res) => {
    const id = asInt(req.params.id);
    const { rows } = await db.query('delete from gestures where id=$1 returning gloss, source', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Sign not found.' });
    // Keep a deleted seed sign from coming back on the next seed upgrade.
    if (SEED_SOURCES.has(rows[0].source)) {
      await db.query('insert into deleted_signs (gloss) values ($1) on conflict do nothing', [rows[0].gloss]);
    }
    invalidateGestures(db);
    await audit(db, req.user.id, 'sign.delete', rows[0].gloss);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- lessons
  r.get('/lessons', async (_req, res) => {
    const { rows } = await db.query(
      `select l.*, coalesce(array_agg(ls.gesture_id order by ls.position) filter (where ls.gesture_id is not null), '{}') as gesture_ids
         from lessons l left join lesson_signs ls on ls.lesson_id = l.id group by l.id order by l.position, l.id`);
    res.json({ lessons: rows.map((l) => ({ ...l, gestureIds: l.gesture_ids })) });
  });

  const lessonFields = (b) => {
    const title = String(b?.title || '').trim();
    const unit = String(b?.unit || '').trim();
    if (!title || title.length > 80) return { error: 'Lesson title is required (up to 80 characters).' };
    if (!unit || unit.length > 60) return { error: 'Unit is required (up to 60 characters).' };
    const description = String(b?.description || '').trim().slice(0, 600);
    const level = ['beginner', 'intermediate', 'advanced'].includes(b?.level) ? b.level : 'beginner';
    return { title, unit, description, level, published: b?.published !== false };
  };

  r.post('/lessons', async (req, res) => {
    const f = lessonFields(req.body);
    if (f.error) return res.status(400).json({ error: f.error });
    const slug = `${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson'}-${Date.now().toString(36)}`;
    const pos = (await db.query('select coalesce(max(position), -1) + 1 as p from lessons')).rows[0].p;
    const { rows } = await db.query(
      'insert into lessons (slug, unit, title, description, level, published, position) values ($1,$2,$3,$4,$5,$6,$7) returning *',
      [slug, f.unit, f.title, f.description, f.level, f.published, pos]);
    await audit(db, req.user.id, 'lesson.create', f.title);
    res.status(201).json({ lesson: { ...rows[0], gestureIds: [] } });
  });

  r.put('/lessons/:id', async (req, res) => {
    const f = lessonFields(req.body);
    if (f.error) return res.status(400).json({ error: f.error });
    const { rows } = await db.query(
      'update lessons set unit=$1, title=$2, description=$3, level=$4, published=$5 where id=$6 returning *',
      [f.unit, f.title, f.description, f.level, f.published, asInt(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Lesson not found.' });
    await audit(db, req.user.id, 'lesson.update', f.title);
    res.json({ lesson: rows[0] });
  });

  r.put('/lessons/:id/signs', async (req, res) => {
    const id = asInt(req.params.id);
    const ids = [...new Set((Array.isArray(req.body?.gestureIds) ? req.body.gestureIds : []).map(Number).filter(Number.isInteger))];
    if (ids.length > 40) return res.status(400).json({ error: 'A lesson holds up to 40 signs.' });
    const l = (await db.query('select title from lessons where id=$1', [id])).rows[0];
    if (!l) return res.status(404).json({ error: 'Lesson not found.' });
    const found = (await db.query('select id from gestures where id = any($1)', [ids])).rows.map((x) => x.id);
    if (found.length !== ids.length) return res.status(400).json({ error: 'Some of those signs no longer exist.' });
    await db.query('delete from lesson_signs where lesson_id=$1', [id]);
    for (const [i, gid] of ids.entries()) await db.query('insert into lesson_signs (lesson_id, gesture_id, position) values ($1,$2,$3)', [id, gid, i]);
    await audit(db, req.user.id, 'lesson.signs', l.title, { count: ids.length });
    res.json({ ok: true });
  });

  r.post('/lessons/reorder', async (req, res) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
    for (const [i, id] of ids.entries()) await db.query('update lessons set position=$1 where id=$2', [i, id]);
    await audit(db, req.user.id, 'lesson.reorder', null, { count: ids.length });
    res.json({ ok: true });
  });

  r.delete('/lessons/:id', async (req, res) => {
    const { rows } = await db.query('delete from lessons where id=$1 returning title', [asInt(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Lesson not found.' });
    await audit(db, req.user.id, 'lesson.delete', rows[0].title);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- feedback
  r.get('/feedback', async (req, res) => {
    const status = ['new', 'reviewing', 'resolved'].includes(req.query.status) ? req.query.status : null;
    const category = FEEDBACK_CATEGORIES.includes(req.query.category) ? req.query.category : null;
    const { rows } = await db.query(
      `select f.*, u.name as user_name, u.email as user_email from feedback f left join users u on u.id = f.user_id
        where ($1::text is null or f.status = $1) and ($2::text is null or f.category = $2)
        order by (f.status = 'new') desc, f.created_at desc limit 500`, [status, category]);
    res.json({ feedback: rows.map(feedbackRow) });
  });

  r.patch('/feedback/:id', async (req, res) => {
    const id = asInt(req.params.id);
    const cur = (await db.query('select * from feedback where id=$1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Feedback not found.' });
    const status = req.body?.status ?? cur.status;
    if (!['new', 'reviewing', 'resolved'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
    let reply = cur.admin_reply, repliedAt = cur.replied_at;
    if (req.body?.adminReply !== undefined) {
      reply = String(req.body.adminReply || '').trim().slice(0, 2000) || null;
      repliedAt = reply ? new Date() : null;
    }
    const { rows } = await db.query('update feedback set status=$1, admin_reply=$2, replied_at=$3 where id=$4 returning *',
      [status, reply, repliedAt, id]);
    await audit(db, req.user.id, 'feedback.update', `#${id}`, { status, replied: !!reply });
    res.json({ feedback: feedbackRow(rows[0]) });
  });

  r.delete('/feedback/:id', async (req, res) => {
    const { rows } = await db.query('delete from feedback where id=$1 returning id', [asInt(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Feedback not found.' });
    await audit(db, req.user.id, 'feedback.delete', `#${rows[0].id}`);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- users
  const adminCount = async () => (await db.query("select count(*)::int n from users where role='admin' and not disabled")).rows[0].n;

  r.get('/users', async (_req, res) => {
    const { rows } = await db.query('select * from users order by created_at desc');
    res.json({ users: rows.map((u) => ({ ...publicUser(u), disabled: u.disabled, lastLoginAt: u.last_login_at })) });
  });

  r.post('/users', async (req, res) => {
    const v = validateCredentials(req.body || {}, { requireName: true });
    if (v.error) return res.status(400).json({ error: v.error });
    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    const exists = await db.query('select 1 from users where email=$1', [v.email]);
    if (exists.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });
    const { rows } = await db.query('insert into users (email, name, password_hash, role) values ($1,$2,$3,$4) returning *',
      [v.email, v.name, await hashPassword(v.password), role]);
    await audit(db, req.user.id, 'user.create', v.email, { role });
    res.status(201).json({ user: publicUser(rows[0]) });
  });

  r.patch('/users/:id', async (req, res) => {
    const id = asInt(req.params.id);
    const cur = (await db.query('select * from users where id=$1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'User not found.' });
    const role = req.body?.role ?? cur.role;
    const disabled = req.body?.disabled ?? cur.disabled;
    const name = req.body?.name != null ? String(req.body.name).trim().slice(0, 60) || cur.name : cur.name;
    if (!['user', 'admin'].includes(role) || typeof disabled !== 'boolean') return res.status(400).json({ error: 'Invalid role or status.' });
    if (id === req.user.id && (role !== 'admin' || disabled)) return res.status(400).json({ error: 'You cannot remove your own admin access.' });
    if (cur.role === 'admin' && !cur.disabled && (role !== 'admin' || disabled) && (await adminCount()) <= 1) {
      return res.status(400).json({ error: 'There must always be at least one active administrator.' });
    }
    const { rows } = await db.query('update users set role=$1, disabled=$2, name=$3 where id=$4 returning *', [role, disabled, name, id]);
    if (disabled) await destroyUserSessions(db, id);
    await audit(db, req.user.id, 'user.update', cur.email, { role, disabled });
    res.json({ user: { ...publicUser(rows[0]), disabled: rows[0].disabled } });
  });

  r.post('/users/:id/password', async (req, res) => {
    const id = asInt(req.params.id);
    const cur = (await db.query('select email from users where id=$1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'User not found.' });
    const v = validateCredentials({ email: cur.email, password: req.body?.password });
    if (v.error) return res.status(400).json({ error: v.error });
    await db.query('update users set password_hash=$1 where id=$2', [await hashPassword(v.password), id]);
    await destroyUserSessions(db, id);
    await audit(db, req.user.id, 'user.password-reset', cur.email);
    res.json({ ok: true });
  });

  r.delete('/users/:id', async (req, res) => {
    const id = asInt(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account here.' });
    const cur = (await db.query('select * from users where id=$1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'User not found.' });
    if (cur.role === 'admin' && !cur.disabled && (await adminCount()) <= 1) {
      return res.status(400).json({ error: 'There must always be at least one active administrator.' });
    }
    await db.query('delete from users where id=$1', [id]);
    await audit(db, req.user.id, 'user.delete', cur.email);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- settings & audit
  r.get('/settings', async (_req, res) => {
    res.json({ settings: await getSettings(db), schema: SETTINGS });
  });
  r.put('/settings', async (req, res) => {
    const v = validateSettings(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    await saveSettings(db, v.values);
    await audit(db, req.user.id, 'settings.update', null, v.values);
    res.json({ settings: await getSettings(db) });
  });

  r.get('/audit', async (req, res) => {
    const limit = Math.min(500, Math.max(1, asInt(req.query.limit) ?? 200));
    const { rows } = await db.query(
      `select a.*, u.name as user_name, u.email as user_email from audit_log a left join users u on u.id = a.user_id
        order by a.created_at desc limit $1`, [limit]);
    res.json({ entries: rows.map((a) => ({ id: a.id, action: a.action, target: a.target, details: a.details, createdAt: a.created_at, user: a.user_id ? { id: a.user_id, name: a.user_name, email: a.user_email } : null })) });
  });

  return r;
}
