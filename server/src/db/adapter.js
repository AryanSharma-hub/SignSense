/**
 * One tiny interface over two Postgres backends:
 *   - DATABASE_URL set  -> node-postgres (any real Postgres, incl. Supabase-hosted)
 *   - DATABASE_URL empty -> PGlite, real Postgres compiled to WASM, running in-process
 *                           and persisting to server/data/pgdata. Zero install.
 * Both expose:  query(sql, params) -> { rows },  exec(sql),  close(),  kind
 */
import fs from 'node:fs';
import { config } from '../config.js';

export async function createDb() {
  if (config.databaseUrl) {
    const pg = await import('pg');
    const pool = new pg.default.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    });
    return {
      kind: 'postgres',
      query: (sql, params = []) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dir = config.pgliteDir;
  // ":memory:" is handy for tests; anything else is a persisted directory.
  if (dir !== ':memory:') fs.mkdirSync(dir, { recursive: true });
  const db = dir === ':memory:' ? new PGlite() : new PGlite(dir);
  await db.waitReady;
  return {
    kind: 'pglite',
    query: (sql, params = []) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}
