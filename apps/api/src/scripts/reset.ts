import { sql } from 'drizzle-orm';
import { createDb } from '../db';
import { runMigrations } from '../db/migrate';
import { loadEnv } from '../env';

// Deletes all local development data and recreates the schema. Refuses to run in production.
const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('db:reset never runs in production');

const { db, close } = createDb(env.DATABASE_URL);
try {
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
} finally {
  await close();
}
await runMigrations(env.DATABASE_URL);
console.info('Database reset. Add sample data with: pnpm db:seed');
