import { config } from './config.js';
import { createDb } from './db/adapter.js';
import { migrate, seedIfEmpty } from './db/seed.js';
import { createApp } from './app.js';
import { seedLessons } from './db/lessons.js';
import { ensureAdmin } from './auth/index.js';

const db = await createDb();
await migrate(db);
const seeded = await seedIfEmpty(db);
if (seeded.seeded) {
  console.log(`${seeded.upgraded ? 'Upgraded' : 'Seeded'} the sign vocabulary — every row stays flagged needs_review until a fluent signer checks it.`);
  if (seeded.removed) console.log(`  removed ${seeded.removed} signs no longer in the seed`);
  if (seeded.kept?.length) console.log(`  kept ${seeded.kept.length} admin-edited signs unchanged`);
}

const lessons = await seedLessons(db);
if (lessons.seeded) console.log(`Created the starter course: ${lessons.lessons} lessons.`);

// Bootstrap administrator from the environment (or use: npm run admin:create -w server).
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const a = await ensureAdmin(db, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME });
  if (a.created) console.log(`Created administrator ${process.env.ADMIN_EMAIL}.`);
} else {
  const { rows } = await db.query("select count(*)::int n from users where role='admin'");
  if (rows[0].n === 0) console.log('No administrator yet. Create one: npm run admin:create -w server -- you@example.com "a-strong-password"');
}

const server = createApp(db).listen(config.port, () => {
  console.log(`SignSense API on http://localhost:${config.port}  (db: ${db.kind})`);
});

// Close the database before exiting. PGlite keeps state in memory and flushes it to
// server/data/pgdata on close; being killed mid-write (Ctrl+C, `node --watch` restarts)
// leaves a data directory Postgres can no longer open.
let closing = false;
const shutdown = async (signal) => {
  if (closing) return;
  closing = true;
  server.close();
  try { await db.close(); } catch (e) { console.error('Closing the database failed:', e); }
  process.exit(signal === 'SIGINT' ? 130 : 0);
};
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => shutdown(s));
