import { Router } from 'express';
import {
  hashPassword, verifyPassword, createSession, destroySession, destroyUserSessions, setSessionCookie, clearSessionCookie,
  readCookie, SESSION_COOKIE, validateCredentials, publicUser, requireUser, audit,
} from '../auth/index.js';
import { getSettings } from '../settings.js';
import { rateLimit } from '../rateLimit.js';

// A dummy hash so a login for an unknown email costs the same time as a real one.
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==';

export function authRoutes(db) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 15 * 60_000, max: 30 });

  r.get('/me', (req, res) => res.json({ user: req.user ?? null }));

  r.post('/register', limiter, async (req, res) => {
    const settings = await getSettings(db);
    if (!settings.registrationOpen) return res.status(403).json({ error: 'New accounts are not being accepted right now.' });
    const v = validateCredentials(req.body || {}, { requireName: true });
    if (v.error) return res.status(400).json({ error: v.error });
    const exists = await db.query('select 1 from users where email=$1', [v.email]);
    if (exists.rows.length) return res.status(409).json({ error: 'An account with that email already exists. Try signing in.' });
    const { rows } = await db.query(
      "insert into users (email, name, password_hash, role, last_login_at) values ($1,$2,$3,'user',now()) returning *",
      [v.email, v.name, await hashPassword(v.password)]);
    const { token, expires } = await createSession(db, rows[0].id);
    setSessionCookie(req, res, token, expires);
    await audit(db, rows[0].id, 'user.register', v.email);
    res.status(201).json({ user: publicUser(rows[0]) });
  });

  r.post('/login', limiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const { rows } = await db.query('select * from users where email=$1', [email]);
    const u = rows[0];
    const ok = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
    if (!u || !ok) return res.status(401).json({ error: 'That email and password don’t match an account.' });
    if (u.disabled) return res.status(403).json({ error: 'This account has been disabled. Contact the site administrator.' });
    await db.query('update users set last_login_at=now() where id=$1', [u.id]);
    await db.query('delete from sessions where user_id=$1 and expires_at < now()', [u.id]);
    const { token, expires } = await createSession(db, u.id);
    setSessionCookie(req, res, token, expires);
    res.json({ user: publicUser(u) });
  });

  r.post('/logout', async (req, res) => {
    await destroySession(db, readCookie(req, SESSION_COOKIE));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  r.patch('/me', requireUser, async (req, res) => {
    const name = String(req.body?.name ?? req.user.name).trim().replace(/\s+/g, ' ');
    if (!name || name.length > 60) return res.status(400).json({ error: 'Enter your name (up to 60 characters).' });
    const { rows } = await db.query('update users set name=$1 where id=$2 returning *', [name, req.user.id]);
    res.json({ user: publicUser(rows[0]) });
  });

  r.post('/password', requireUser, limiter, async (req, res) => {
    const { rows } = await db.query('select password_hash from users where id=$1', [req.user.id]);
    if (!(await verifyPassword(String(req.body?.currentPassword || ''), rows[0].password_hash))) {
      return res.status(400).json({ error: 'Your current password is not correct.' });
    }
    const v = validateCredentials({ email: req.user.email, password: req.body?.newPassword });
    if (v.error) return res.status(400).json({ error: v.error });
    await db.query('update users set password_hash=$1 where id=$2', [await hashPassword(v.password), req.user.id]);
    // Sign out every other device; keep this one.
    await destroyUserSessions(db, req.user.id);
    const { token, expires } = await createSession(db, req.user.id);
    setSessionCookie(req, res, token, expires);
    await audit(db, req.user.id, 'user.password-change', req.user.email);
    res.json({ ok: true });
  });

  return r;
}
