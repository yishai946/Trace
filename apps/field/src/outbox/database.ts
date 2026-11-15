import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const SCHEMA_VERSION = 1;

let opened: Promise<SQLiteDatabase> | null = null;

export function database(): Promise<SQLiteDatabase> {
  opened ??= openDatabaseAsync('trace-outbox.db')
    .then(async (db) => {
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS outbox (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL,
            mission_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS outbox_stream ON outbox (kind, mission_id, seq);
          PRAGMA user_version = ${SCHEMA_VERSION};
        `);
      }
      return db;
    })
    .catch((error: unknown) => {
      opened = null;
      throw error;
    });
  return opened;
}

/**
 * Every write goes through here, one at a time. The connection is shared, and `withTransactionAsync` is not exclusive:
 * two overlapping transactions fail on BEGIN, and the loser's ROLLBACK also undoes the winner's rows.
 */
let writes: Promise<unknown> = Promise.resolve();
export function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = writes.then(task, task);
  writes = result.catch(() => undefined);
  return result;
}
