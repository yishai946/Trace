import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { uuidv7 } from './uuidv7';

/**
 * The outbox: what the phone must tell the server but could not yet (UC-S01, UC-S03, UC-F10). Items wait in a SQLite table on
 * the device, oldest first, and an item is deleted only after the server confirmed it, so a failed or interrupted send
 * loses nothing. Each kind of item has a sender that knows its endpoint; the outbox knows only order and deletion.
 */
export type OutboxKind = 'track-point' | 'sighting';

export interface OutboxItem {
  /** Time-ordered UUID, made on the phone. */
  id: string;
  kind: OutboxKind;
  missionId: string;
  /** What the sender sends, as it was when recorded. Not validated here: the sender validates it. */
  payload: unknown;
  /** Milliseconds since the epoch, when the item was added. */
  createdAt: number;
}

/**
 * What the server answered for a batch. `sent`: it took the batch. `drop-batch`: it will never take this batch (it is
 * invalid). `drop-mission`: it will take nothing more of this mission (the activity ended, or access is gone). A
 * sender throws when the answer is not final (no network, server error, no token), and the items stay.
 */
export type SendOutcome = 'sent' | 'drop-batch' | 'drop-mission';

export interface OutboxSender {
  /** Most items of one send. */
  batchSize: number;
  /** Sends the oldest items of one mission, in order. */
  send(missionId: string, items: OutboxItem[]): Promise<SendOutcome>;
}

interface Row {
  seq: number;
  id: string;
  kind: OutboxKind;
  mission_id: string;
  payload: string;
  created_at: number;
}

const SCHEMA_VERSION = 1;

let opened: Promise<SQLiteDatabase> | null = null;

function database(): Promise<SQLiteDatabase> {
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
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = writes.then(task, task);
  writes = result.catch(() => undefined);
  return result;
}

function toItem(row: Row): OutboxItem | null {
  try {
    return {
      id: row.id,
      kind: row.kind,
      missionId: row.mission_id,
      payload: JSON.parse(row.payload),
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
}

/** How many dropped ids are remembered; a refused item is looked up right after its send, so a few are enough. */
const DROPPED_MEMORY = 200;
/** Ids of items the server refused for good and the outbox deleted, newest last. Kept in memory only. */
const dropped = new Set<string>();

function rememberDropped(ids: string[]): void {
  for (const id of ids) {
    dropped.delete(id);
    dropped.add(id);
  }
  for (const id of dropped) {
    if (dropped.size <= DROPPED_MEMORY) break;
    dropped.delete(id);
  }
}

/**
 * Whether the item with this id was deleted because the server refused it for good (`drop-batch`, `drop-mission`), as
 * opposed to confirmed. Lets a caller tell a rejected sighting from a sent one once the item is no longer pending.
 */
export function wasDropped(id: string): boolean {
  return dropped.has(id);
}

/**
 * Adds items to the end of the queue, in the order given. `ids` are the items' ids when the caller made them (a
 * sighting keeps the id it has on the server); an id already in the queue is left as it was. Otherwise each gets a new
 * UUIDv7.
 */
export async function enqueue({
  kind,
  missionId,
  payloads,
  ids,
}: {
  kind: OutboxKind;
  missionId: string;
  payloads: unknown[];
  ids?: string[];
}): Promise<void> {
  if (payloads.length === 0) return;
  const db = await database();
  const now = Date.now();
  await serialized(() =>
    db.withTransactionAsync(async () => {
      for (const [i, payload] of payloads.entries()) {
        await db.runAsync(
          'INSERT OR IGNORE INTO outbox (id, kind, mission_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
          ids?.[i] ?? uuidv7(),
          kind,
          missionId,
          JSON.stringify(payload),
          now,
        );
      }
    }),
  );
}

/** Everything that waits, oldest first. */
export async function pending(): Promise<OutboxItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>('SELECT * FROM outbox ORDER BY seq');
  return rows.flatMap((row) => toItem(row) ?? []);
}

/** Whether the item with this id still waits. */
export async function isPending(id: string): Promise<boolean> {
  const db = await database();
  return (await db.getFirstAsync('SELECT 1 FROM outbox WHERE id = ?', id)) !== null;
}

export async function pendingCount(): Promise<number> {
  const db = await database();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

/** Forgets everything that waits, e.g. at sign-out. */
export async function clearOutbox(): Promise<void> {
  const db = await database();
  await serialized(() => db.runAsync('DELETE FROM outbox'));
  dropped.clear();
}

async function deleteIds(db: SQLiteDatabase, ids: string[]): Promise<void> {
  await serialized(() =>
    db.withTransactionAsync(async () => {
      for (const id of ids) await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    }),
  );
}

/** Sends batches until the outbox is empty or a send fails; a failure stops the flush and leaves the rest. */
async function flushOnce(senders: Partial<Record<OutboxKind, OutboxSender>>): Promise<void> {
  const db = await database();
  for (;;) {
    // A row of a kind without a sender is kept (a later version may know it) and skipped, not deleted.
    const kinds = Object.keys(senders);
    const head = await db.getFirstAsync<Row>(
      `SELECT * FROM outbox WHERE kind IN (${kinds.map(() => '?').join(', ')}) ORDER BY seq LIMIT 1`,
      ...kinds,
    );
    if (!head) return;
    const sender = senders[head.kind];
    if (!sender) return;
    const rows = await db.getAllAsync<Row>(
      'SELECT * FROM outbox WHERE kind = ? AND mission_id = ? ORDER BY seq LIMIT ?',
      head.kind,
      head.mission_id,
      sender.batchSize,
    );
    const items: OutboxItem[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const item = toItem(row);
      if (item) items.push(item);
      else unreadable.push(row.id);
    }
    // A payload that is not valid JSON can never be sent; keeping it would block the queue behind it.
    if (unreadable.length > 0) await deleteIds(db, unreadable);
    if (items.length === 0) continue;

    let outcome: SendOutcome;
    try {
      outcome = await sender.send(head.mission_id, items);
    } catch {
      return;
    }
    if (outcome === 'drop-mission') {
      const ids = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM outbox WHERE kind = ? AND mission_id = ?',
        head.kind,
        head.mission_id,
      );
      rememberDropped(ids.map((row) => row.id));
      await serialized(() =>
        db.runAsync('DELETE FROM outbox WHERE kind = ? AND mission_id = ?', head.kind, head.mission_id),
      );
    } else {
      const ids = items.map((item) => item.id);
      if (outcome === 'drop-batch') rememberDropped(ids);
      await deleteIds(db, ids);
    }
  }
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Sends what waits, one batch at a time, oldest first within a mission. Safe to call from any trigger: calls while a
 * flush runs do not start a second one; they make it look once more, so items added meanwhile are sent too.
 */
export function flushOutbox(senders: Partial<Record<OutboxKind, OutboxSender>>): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await flushOnce(senders);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}
