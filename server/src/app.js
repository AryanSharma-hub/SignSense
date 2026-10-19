import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, featureFlags } from './config.js';
import { rateLimit } from './rateLimit.js';
import { vocabularyRoutes } from './routes/vocabulary.js';
import { aiRoutes } from './routes/ai.js';
import { sttRoutes } from './routes/stt.js';
import { authRoutes } from './routes/auth.js';
import { learnRoutes } from './routes/learn.js';
import { feedbackRoutes } from './routes/feedback.js';
import { adminRoutes } from './routes/admin.js';
import { attachUser, csrfGuard } from './auth/index.js';
import { getSettings } from './settings.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  // Same-origin by design (the built client is served from this app; Vite proxies in dev).
  // cors() without `credentials` never lets another origin send our session cookie.
  app.use(cors());
  app.use('/api', attachUser(db), csrfGuard);

  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.kind }));
  app.get('/api/config', (_req, res) => res.json(featureFlags()));
  app.get('/api/settings', async (_req, res) => {
    const s = await getSettings(db);
    res.json({ settings: { siteTitle: s.siteTitle, tagline: s.tagline, announcement: s.announcement,
      registrationOpen: s.registrationOpen, learningEnabled: s.learningEnabled, feedbackEnabled: s.feedbackEnabled } });
  });

  const json = express.json({ limit: '256kb' });
  app.use('/api/auth', json, authRoutes(db));
  app.use('/api/learn', json, learnRoutes(db));
  app.use('/api/feedback', json, feedbackRoutes(db));
  app.use('/api/admin', json, adminRoutes(db));

  app.use('/api', vocabularyRoutes(db));

  const limiter = rateLimit();
  app.use('/api/ai', limiter, express.json({ limit: '32kb' }), aiRoutes(db));
  app.use('/api/stt', limiter, sttRoutes());

  // Serve the built client in production.
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(indexHtml);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500 && status !== 502 && status !== 503) console.error(err); // upstream/config problems are expected, not bugs
    res.status(status).json({ error: status >= 500 && status !== 503 && status !== 502 ? 'Something went wrong on the server.' : err.message });
  });
  return app;
}
