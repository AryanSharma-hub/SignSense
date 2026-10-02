import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { config, featureFlags } from './config.js';
import { rateLimit } from './rateLimit.js';
import { vocabularyRoutes } from './routes/vocabulary.js';
import { aiRoutes } from './routes/ai.js';
import { sttRoutes } from './routes/stt.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());

  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.kind }));
  app.get('/api/config', (_req, res) => res.json(featureFlags()));

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
