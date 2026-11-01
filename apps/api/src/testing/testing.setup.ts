import postgres from 'postgres';
import { runMigrations } from '../db/migrate';
import { TEST_DATABASE_URL } from './testing.config';

/** Vitest global setup: recreates the test database and applies the migrations once per run. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql`select 1`;
  } catch (error) {
    await sql.end();
    throw new Error(`Cannot reach the test database at ${url.host}. Start it with: docker compose up -d db`, {
      cause: error,
    });
  }
  try {
    await sql.unsafe(`drop database if exists "${name}" with (force)`);
    await sql.unsafe(`create database "${name}"`);
  } finally {
    await sql.end();
  }
  await runMigrations(TEST_DATABASE_URL);
}
