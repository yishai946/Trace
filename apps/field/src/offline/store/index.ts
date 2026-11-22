import type { z } from 'zod';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/** The pieces of the offline package, saved one by one so an interrupted download can resume (UC-F03). */
export type OfflineStep = 'mission' | 'photo' | 'polygons';

export interface StepContent {
  json?: unknown;
  bytes?: Uint8Array<ArrayBuffer>;
  contentType?: string;
}

let opened: Promise<SQLiteDatabase> | null = null;

function database(): Promise<SQLiteDatabase> {
  opened ??= openDatabaseAsync('trace-offline.db')
    .then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS offline_steps (
          mission_id TEXT NOT NULL,
          step TEXT NOT NULL,
          json TEXT,
          bytes BLOB,
          content_type TEXT,
          saved_at INTEGER NOT NULL,
          PRIMARY KEY (mission_id, step)
        );
      `);
      return db;
    })
    .catch((error: unknown) => {
      opened = null;
      throw error;
    });
  return opened;
}

/** Saves one step of a mission's package. The step counts as saved only once this resolves. */
export async function saveStep(missionId: string, step: OfflineStep, content: StepContent): Promise<void> {
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO offline_steps (mission_id, step, json, bytes, content_type, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
    missionId,
    step,
    content.json === undefined ? null : JSON.stringify(content.json),
    content.bytes ?? null,
    content.contentType ?? null,
    Date.now(),
  );
}

const isStep = (value: unknown): value is OfflineStep =>
  value === 'mission' || value === 'photo' || value === 'polygons';

/** The steps of the mission's package that are saved. */
export async function savedSteps(missionId: string): Promise<OfflineStep[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ step: unknown }>(
    'SELECT step FROM offline_steps WHERE mission_id = ?',
    missionId,
  );
  return rows.map((row) => row.step).filter(isStep);
}

/** A saved JSON step, checked against its schema; null when it is not saved or no longer fits (so it is downloaded again). */
export async function loadStep<S extends z.ZodType>(
  missionId: string,
  step: OfflineStep,
  schema: S,
): Promise<z.infer<S> | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ json: string | null }>(
    'SELECT json FROM offline_steps WHERE mission_id = ? AND step = ?',
    missionId,
    step,
  );
  if (!row?.json) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(row.json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The saved photo of the missing person; null when the mission has none or it is not saved. */
export async function loadPhoto(missionId: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ bytes: Uint8Array | null; content_type: string | null }>(
    "SELECT bytes, content_type FROM offline_steps WHERE mission_id = ? AND step = 'photo'",
    missionId,
  );
  return row?.bytes ? { bytes: row.bytes, contentType: row.content_type ?? 'application/octet-stream' } : null;
}

/** Drops the packages of every mission but this one: a searcher is in one mission at a time. */
export async function keepOnly(missionId: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM offline_steps WHERE mission_id <> ?', missionId);
}

/** Drops every saved package, on sign-out: the missing person's details belong to this searcher's mission only. */
export async function clearOfflinePackages(): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM offline_steps');
}
