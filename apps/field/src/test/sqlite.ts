import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

// Loaded at run time: Vite cannot bundle `node:sqlite` for the jsdom (client) environment.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

type Params = unknown[];

/** Accepts both `runAsync(sql, [a, b])` and `runAsync(sql, a, b)`, as expo-sqlite does. */
const flat = (params: Params): never[] =>
  (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as never[];

/** A stand-in for an expo-sqlite database, on node:sqlite in memory (expo-sqlite has no web/node implementation). */
class FakeDatabase {
  readonly db: DatabaseSyncType = new DatabaseSync(':memory:');

  async execAsync(source: string) {
    this.db.exec(source);
  }
  async runAsync(source: string, ...params: Params) {
    const result = this.db.prepare(source).run(...flat(params));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async getAllAsync<T>(source: string, ...params: Params) {
    return this.db.prepare(source).all(...flat(params)) as T[];
  }
  async getFirstAsync<T>(source: string, ...params: Params) {
    return (this.db.prepare(source).get(...flat(params)) as T | undefined) ?? null;
  }
  async withTransactionAsync(task: () => Promise<void>) {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  async withExclusiveTransactionAsync(task: (txn: FakeDatabase) => Promise<void>) {
    await this.withTransactionAsync(() => task(this));
  }
}

let database: FakeDatabase | null = null;

export async function openDatabaseAsync(_name: string) {
  database ??= new FakeDatabase();
  return database;
}

/** Empties every table but keeps the schema and the open handle, so the next test starts empty. */
export function reset() {
  if (!database) return;
  const tables = database.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  for (const { name } of tables) {
    if (name !== 'sqlite_sequence') database.db.exec(`DELETE FROM "${name}"`);
  }
  if (tables.some((t) => t.name === 'sqlite_sequence')) database.db.exec('DELETE FROM sqlite_sequence');
}
