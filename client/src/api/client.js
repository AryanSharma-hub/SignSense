/** Thin fetch wrapper. In dev, Vite proxies /api to the Express server. */
const BASE = '/api';

async function request(path, init) {
  const res = await fetch(BASE + path, init);
  let body = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const api = {
  get: (path) => request(path),
  post: (path, json) => request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(json) }),
  postAudio: (path, blob) => request(path, { method: 'POST', headers: { 'content-type': blob.type || 'audio/webm' }, body: blob }),
};
