/**
 * Thin fetch wrapper. In dev, Vite proxies /api to the Express server; in production the
 * server serves the client, so requests are same-origin and the session cookie (HttpOnly,
 * set by the server) rides along automatically. State-changing requests carry the CSRF
 * header the server requires.
 */
const BASE = '/api';
const CSRF = { 'x-requested-with': 'SignSense' };

async function request(path, init = {}) {
  const res = await fetch(BASE + path, { credentials: 'same-origin', ...init });
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const send = (method) => (path, json) => request(path, {
  method, headers: { 'content-type': 'application/json', ...CSRF }, body: JSON.stringify(json ?? {}),
});

export const api = {
  get: (path) => request(path),
  post: send('POST'),
  put: send('PUT'),
  patch: send('PATCH'),
  del: (path) => request(path, { method: 'DELETE', headers: CSRF }),
  postAudio: (path, blob) => request(path, { method: 'POST', headers: { 'content-type': blob.type || 'audio/webm', ...CSRF }, body: blob }),
};
