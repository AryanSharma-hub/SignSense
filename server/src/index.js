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

createApp(db).listen(config.port, () => {
  console.log(`SignSense API on http://localhost:${config.port}  (db: ${db.kind})`);
});
