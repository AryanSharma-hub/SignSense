import { Router } from 'express';
import { getParameters, getGesturesCached } from '../db/queries.js';

export function vocabularyRoutes(db) {
  const r = Router();
  r.get('/parameters', async (_req, res) => res.json(await getParameters(db)));
  r.get('/gestures', async (_req, res) => res.json({ gestures: await getGesturesCached(db) }));
  r.get('/gestures/:gloss', async (req, res) => {
    const gloss = String(req.params.gloss).toUpperCase();
    const g = (await getGesturesCached(db)).find((x) => x.gloss === gloss);
    if (!g) return res.status(404).json({ error: `No gesture "${gloss}".` });
    res.json(g);
  });
  return r;
}
