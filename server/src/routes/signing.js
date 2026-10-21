import express from 'express';
import { config } from '../config.js';
import { animateWords } from '../signing/animate.js';

const MAX_WORDS = 24;
const MAX_LEN = 60;

/**
 * POST /api/signing/animate  { words: ["thank you", "mother"] }
 *   -> an animation clip of recorded ASL for the 3D signer's rig (see signing/animate.js).
 * Words are the signing order; a word ASL has no sign for comes back fingerspelled.
 */
export function signingRoutes() {
  const r = express.Router();
  r.post('/animate', async (req, res) => {
    if (!config.signmtUrl) return res.status(503).json({ error: 'Recorded signing is turned off on this server.' });
    const words = Array.isArray(req.body?.words) ? req.body.words.map((w) => String(w ?? '').trim()).filter(Boolean) : [];
    if (!words.length) return res.status(400).json({ error: 'Send the words to sign, e.g. {"words": ["thank you"]}.' });
    if (words.length > MAX_WORDS || words.some((w) => w.length > MAX_LEN)) return res.status(400).json({ error: `At most ${MAX_WORDS} words of ${MAX_LEN} characters.` });
    try {
      res.json(await animateWords(words));
    } catch (e) {
      res.status(502).json({ error: `Recorded signing is unavailable right now: ${e.message}` });
    }
  });
  return r;
}
