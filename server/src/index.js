import { config } from './config.js';
import { createDb } from './db/adapter.js';
import { migrate, seedIfEmpty } from './db/seed.js';
import { createApp } from './app.js';

const db = await createDb();
await migrate(db);
const seeded = await seedIfEmpty(db);
if (seeded.seeded) console.log('Seeded draft vocabulary — every row is flagged needs_review.');

createApp(db).listen(config.port, () => {
  console.log(`SignSense API on http://localhost:${config.port}  (db: ${db.kind})`);
});
