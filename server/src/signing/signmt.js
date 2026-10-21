import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * sign.mt (https://sign.mt, open-source sign language translation; code CC BY-NC-SA 4.0):
 * text -> a .pose recording of the signs, stitched from its lexicon of real signers' videos.
 * Unknown words come back fingerspelled. One word or phrase per request, so each clip has
 * clean boundaries and can be cached on disk and reused across sentences.
 */
const cacheDir = () => path.join(config.dataDir, 'signmt-cache');
const key = (text) => crypto.createHash('sha1').update(`ase|${text.toLowerCase().trim()}`).digest('hex');

/** The .pose bytes for one English word or phrase in ASL; cached. Throws on failure. */
export async function fetchSignPose(text, { timeoutMs = 25000, fetchImpl = fetch } = {}) {
  const t = String(text || '').trim();
  if (!t) throw new Error('empty text');
  const file = path.join(cacheDir(), `${key(t)}.pose`);
  try { return fs.readFileSync(file); } catch { /* not cached yet */ }
  const url = new URL(config.signmtUrl);
  url.searchParams.set('text', t);
  url.searchParams.set('spoken', 'en');
  url.searchParams.set('signed', 'ase');
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`sign.mt answered ${res.status} for "${t}"`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 64) throw new Error(`sign.mt returned no pose for "${t}"`);
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(file, bytes);
  return bytes;
}
