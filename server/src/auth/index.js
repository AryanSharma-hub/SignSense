/**
 * Accounts and sessions — no third-party auth dependency.
 *
 *   passwords  scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte random salt), compared in
 *              constant time; stored as "scrypt$N$r$p$salt$hash" so parameters can be raised
 *   sessions   a 32-byte random token in an HttpOnly, SameSite=Lax cookie; only its SHA-256
 *              is stored, so a database leak does not leak live sessions
 *   CSRF       every state-changing API request must carry the custom header
 *              `X-Requested-With: SignSense` (a cross-site form or image cannot set it, and
 *              cross-origin scripts cannot send it with our cookie)
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'ss_session';
export const SESSION_DAYS = 30;
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'SignSense';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password).normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(String(password).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p) });
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.query('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [sha256(token), userId, expires]);
  return { token, expires };
}

export async function destroySession(db, token) {
  if (token) await db.query('delete from sessions where token_hash=$1', [sha256(token)]);
}

export async function destroyUserSessions(db, userId) {
  await db.query('delete from sessions where user_id=$1', [userId]);
}

/** The signed-in user for a session token, or null (expired, disabled or unknown). */
export async function userForToken(db, token) {
  if (!token) return null;
  const { rows } = await db.query(
    `select u.id, u.email, u.name, u.role, u.disabled, u.created_at from sessions s join users u on u.id = s.user_id
     where s.token_hash=$1 and s.expires_at > now()`, [sha256(token)]);
  const u = rows[0];
  return u && !u.disabled ? publicUser(u) : null;
}

export const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at });

export function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function setSessionCookie(req, res, token, expires) {
  const secure = req.secure || process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure ? '; Secure' : ''}`);
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Attach req.user (or null) on every API request. */
export function attachUser(db) {
  return async (req, _res, next) => {
    try { req.user = await userForToken(db, readCookie(req, SESSION_COOKIE)); } catch (e) { return next(e); }
    next();
  };
}

/** Reject state-changing requests that lack the CSRF header. */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get(CSRF_HEADER) !== CSRF_VALUE) return res.status(403).json({ error: 'Missing request header.' });
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  next();
}
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrators only.' });
  next();
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export function validateCredentials({ email, password, name }, { requireName = false } = {}) {
  const e = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return { error: 'Enter a valid email address.' };
  if (typeof password !== 'string' || password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  if (password.length > 200) return { error: 'That password is too long.' };
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (requireName && (n.length < 1 || n.length > 60)) return { error: 'Enter your name (up to 60 characters).' };
  return { email: e, password, name: n };
}

export async function audit(db, userId, action, target = null, details = null) {
  await db.query('insert into audit_log (user_id, action, target, details) values ($1,$2,$3,$4)',
    [userId ?? null, action, target, details ? JSON.stringify(details) : null]);
}

/** Create or promote the bootstrap administrator (ADMIN_EMAIL / ADMIN_PASSWORD, or the CLI). */
export async function ensureAdmin(db, { email, password, name = 'Administrator' }) {
  const v = validateCredentials({ email, password, name });
  if (v.error) throw new Error(`Admin account: ${v.error}`);
  const { rows } = await db.query('select id, role from users where email=$1', [v.email]);
  if (rows[0]) {
    if (rows[0].role !== 'admin') await db.query("update users set role='admin', disabled=false where id=$1", [rows[0].id]);
    return { id: rows[0].id, created: false };
  }
  const { rows: ins } = await db.query(
    "insert into users (email, name, password_hash, role) values ($1,$2,$3,'admin') returning id",
    [v.email, v.name || 'Administrator', await hashPassword(v.password)]);
  return { id: ins[0].id, created: true };
}
