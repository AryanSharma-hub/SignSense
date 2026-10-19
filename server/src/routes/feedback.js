import { Router } from 'express';
import { requireUser } from '../auth/index.js';
import { getSettings } from '../settings.js';
import { rateLimit } from '../rateLimit.js';

export const FEEDBACK_CATEGORIES = ['sign-accuracy', 'lesson', 'bug', 'suggestion', 'other'];

const feedbackRow = (f) => ({
  id: f.id, category: f.category, rating: f.rating, message: f.message, page: f.page,
  gestureId: f.gesture_id, gloss: f.gloss, status: f.status, adminReply: f.admin_reply,
  repliedAt: f.replied_at, createdAt: f.created_at,
  ...(f.user_name !== undefined ? { user: f.user_id ? { id: f.user_id, name: f.user_name, email: f.user_email } : null } : {}),
});
export { feedbackRow };

export function feedbackRoutes(db) {
  const r = Router();
  r.use(requireUser);

  r.get('/mine', async (req, res) => {
    const { rows } = await db.query('select * from feedback where user_id=$1 order by created_at desc limit 100', [req.user.id]);
    res.json({ feedback: rows.map(feedbackRow) });
  });

  r.post('/', rateLimit({ windowMs: 60 * 60_000, max: 30 }), async (req, res) => {
    const s = await getSettings(db);
    if (!s.feedbackEnabled && req.user.role !== 'admin') return res.status(403).json({ error: 'Feedback is switched off right now.' });
    const b = req.body || {};
    const category = FEEDBACK_CATEGORIES.includes(b.category) ? b.category : null;
    if (!category) return res.status(400).json({ error: 'Choose what your feedback is about.' });
    const message = String(b.message || '').trim();
    if (message.length < 3 || message.length > 2000) return res.status(400).json({ error: 'Write between 3 and 2000 characters.' });
    const rating = b.rating == null || b.rating === '' ? null : Number(b.rating);
    if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5.' });
    let gestureId = null, gloss = null;
    if (b.gestureId != null) {
      const { rows } = await db.query('select id, gloss from gestures where id=$1', [Number(b.gestureId)]);
      if (!rows[0]) return res.status(400).json({ error: 'That sign no longer exists.' });
      gestureId = rows[0].id; gloss = rows[0].gloss;
    }
    const page = b.page ? String(b.page).slice(0, 200) : null;
    const { rows } = await db.query(
      `insert into feedback (user_id, gesture_id, gloss, category, rating, message, page)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`, [req.user.id, gestureId, gloss, category, rating, message, page]);
    res.status(201).json({ feedback: feedbackRow(rows[0]) });
  });

  return r;
}
