import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from 'node:sqlite';

// Loaded at run time: Vite cannot bundle `node:sqlite` for the jsdom (client) environment.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

type Params = unknown[];

/** What node:sqlite can bind; it throws on anything else (booleans, undefined), so the fake says so up front. */
const isSqlValue = (value: unknown): value is SQLInputValue =>
  value === null ||
  typeof value === 'number' ||
  typeof value === 'bigint' ||
  typeof value === 'string' ||
  ArrayBuffer.isView(value);

/** Accepts both `runAsync(sql, [a, b])` and `runAsync(sql, a, b)`, as expo-sqlite does. */
function flat(params: Params): SQLInputValue[] {
  const [first] = params;
  const values: unknown[] = params.length === 1 && Array.isArray(first) ? first : params;
  return values.map((value) => {
    if (isSqlValue(value)) return value;
    throw new TypeError(`Cannot bind a ${typeof value} to SQLite`);
  });
}

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
  async getAllAsync(source: string, ...params: Params) {
    return this.db.prepare(source).all(...flat(params));
  }
  async getFirstAsync(source: string, ...params: Params) {
    return this.db.prepare(source).get(...flat(params)) ?? null;
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
  const names = database.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
  for (const name of names) {
    if (typeof name === 'string' && name !== 'sqlite_sequence') database.db.exec(`DELETE FROM "${name}"`);
  }
  if (names.includes('sqlite_sequence')) database.db.exec('DELETE FROM sqlite_sequence');
}
