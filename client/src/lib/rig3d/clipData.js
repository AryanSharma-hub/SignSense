/**
 * Recorded-signing clips (POST /api/signing/animate): fetching, decoding and timing.
 * Kept free of Three.js so the stage player can use it without loading the 3D signer.
 */

let webgl2 = null;
/** True when this browser runs the 3D signer (only it can play clips). */
export function canPlayClips() {
  if (webgl2 !== null) return webgl2;
  try {
    webgl2 = typeof window !== 'undefined' && typeof window.WebGL2RenderingContext !== 'undefined'
      && !!document.createElement('canvas').getContext('webgl2');
  } catch { webgl2 = false; }
  return webgl2;
}

const decode = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return Float32Array.from(new Int16Array(bytes.buffer), (v) => v / 32767);
};

/** The server's JSON -> { fps, bones, faceShapes, frames: Float32Array[], face: Float32Array[], words, duration }. */
export function decodeClip(json) {
  const raw = json.encoding === 'int16-base64';
  const frames = json.frames.map((f) => (raw ? decode(f) : Float32Array.from(f)));
  const face = json.face.map((f) => (raw ? decode(f) : Float32Array.from(f)));
  for (const q of frames) { // re-normalize after quantization
    for (let i = 0; i < q.length; i += 4) {
      const n = Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3]) || 1;
      q[i] /= n; q[i + 1] /= n; q[i + 2] /= n; q[i + 3] /= n;
    }
  }
  return { fps: json.fps, bones: json.bones, faceShapes: json.faceShapes, frames, face, words: json.words, duration: (frames.length - 1) / json.fps };
}

/** What to ask the server to sign for a word: its gloss, without a sense note ("BOW (noun)" -> "bow"). */
export const wordText = (w) => String(w.english || w.gloss || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim().toLowerCase();

/** Fetch and decode the recorded signing for these words. Throws when it is unavailable. */
export async function fetchClip(words, { signal, timeoutMs = 20000 } = {}) {
  const texts = words.map(wordText);
  if (!texts.length || texts.some((t) => !t)) throw new Error('nothing to sign');
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch('/api/signing/animate', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'SignSense' },
    body: JSON.stringify({ words: texts }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) {
    const err = new Error((await res.json().catch(() => null))?.error || `Recorded signing failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return decodeClip(await res.json());
}

/**
 * Each word's stretch of the clip, in seconds: a word owns the transition INTO it, and the
 * last word also owns the return to rest — so the spans tile the whole clip.
 */
export function clipSpans(clip) {
  const n = clip.words.length;
  return clip.words.map((w, i) => [i === 0 ? 0 : clip.words[i - 1].end / clip.fps, i === n - 1 ? clip.duration : w.end / clip.fps]);
}
