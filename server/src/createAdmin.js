/**
 * Create (or promote) an administrator account:
 *   npm run admin:create -w server -- you@example.com "a-strong-password" ["Your Name"]
 */
import { createDb } from './db/adapter.js';
import { migrate } from './db/seed.js';
import { ensureAdmin } from './auth/index.js';

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run admin:create -w server -- <email> <password> [name]');
  process.exit(1);
}
const db = await createDb();
await migrate(db);
try {
  const r = await ensureAdmin(db, { email, password, name: name || 'Administrator' });
  console.log(r.created ? `Created administrator ${email}.` : `${email} is now an administrator.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
