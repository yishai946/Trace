import type { SQLiteDatabase } from 'expo-sqlite';
import { notifyChange } from './changes';
import { database, serialized } from './database';
import { forgetDropped, rememberDropped } from './dropped';
import type { OutboxItem, OutboxKind, OutboxSender, Row, SendOutcome } from './types';
import { uuidv7 } from './uuidv7';

export { onOutboxChange } from './changes';
export { markDroppedSeen, unseenDropped, wasDropped } from './dropped';
export type { OutboxItem, OutboxKind, OutboxSender, SendOutcome } from './types';

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
  notifyChange();
}

/** Everything that waits, oldest first. */
export async function pending(): Promise<OutboxItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>('SELECT * FROM outbox ORDER BY seq');
  return rows.flatMap((row) => toItem(row) ?? []);
}

/** The items of one kind and mission that wait, oldest first. */
export async function pendingOf(kind: OutboxKind, missionId: string): Promise<OutboxItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM outbox WHERE kind = ? AND mission_id = ? ORDER BY seq',
    kind,
    missionId,
  );
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
  forgetDropped();
  notifyChange();
}

async function deleteIds(db: SQLiteDatabase, ids: string[]): Promise<void> {
  await serialized(() =>
    db.withTransactionAsync(async () => {
      for (const id of ids) await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    }),
  );
  notifyChange();
}

/**
 * Sends batches until the outbox is empty. A failed send leaves that kind and mission as it was and is not tried again
 * in this flush, so one stalled mission does not hold up the others; order within a mission is kept.
 */
async function flushOnce(senders: Partial<Record<OutboxKind, OutboxSender>>): Promise<void> {
  const db = await database();
  const failed: { kind: string; missionId: string }[] = [];
  for (;;) {
    // A row of a kind without a sender is kept (a later version may know it) and skipped, not deleted.
    const kinds = Object.keys(senders);
    const skipFailed = failed.map(() => ' AND NOT (kind = ? AND mission_id = ?)').join('');
    const head = await db.getFirstAsync<Row>(
      `SELECT * FROM outbox WHERE kind IN (${kinds.map(() => '?').join(', ')})${skipFailed} ORDER BY seq LIMIT 1`,
      ...kinds,
      ...failed.flatMap((stream) => [stream.kind, stream.missionId]),
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
      failed.push({ kind: head.kind, missionId: head.mission_id });
      continue;
    }
    if (outcome === 'drop-mission') {
      const ids = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM outbox WHERE kind = ? AND mission_id = ?',
        head.kind,
        head.mission_id,
      );
      rememberDropped(
        head.kind,
        ids.map((row) => row.id),
      );
      await serialized(() =>
        db.runAsync('DELETE FROM outbox WHERE kind = ? AND mission_id = ?', head.kind, head.mission_id),
      );
      notifyChange();
    } else {
      const ids = items.map((item) => item.id);
      if (outcome === 'drop-batch') rememberDropped(head.kind, ids);
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
