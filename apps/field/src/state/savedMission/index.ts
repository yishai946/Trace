import { OwnParticipation } from '@trace/schemas';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/** The mission the searcher is in and their participation, kept on the device so a restart returns to it (UC-F16). */
export interface SavedMission {
  missionId: string;
  participation: OwnParticipation;
}

let opened: Promise<SQLiteDatabase> | null = null;

function database(): Promise<SQLiteDatabase> {
  opened ??= openDatabaseAsync('trace-session.db')
    .then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS saved_mission (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          mission_id TEXT NOT NULL,
          participation TEXT NOT NULL
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

/** Every write waits for the one before it, so an older state cannot land after a newer one. */
let writes: Promise<unknown> = Promise.resolve();
function inOrder(task: () => Promise<void>): Promise<void> {
  const result = writes.then(task, task);
  writes = result.catch(() => undefined);
  return result;
}

/** Saves the mission and participation as they are now. Never throws: the screens already hold the state in memory. */
export function saveMission(missionId: string, participation: OwnParticipation): Promise<void> {
  return inOrder(async () => {
    const db = await database();
    await db.runAsync(
      'INSERT OR REPLACE INTO saved_mission (id, mission_id, participation) VALUES (1, ?, ?)',
      missionId,
      JSON.stringify(participation),
    );
  }).catch(() => undefined);
}

/** Forgets the saved mission: the searcher left it, signed out, or the server no longer knows them in it. */
export function clearSavedMission(): Promise<void> {
  return inOrder(async () => {
    const db = await database();
    await db.runAsync('DELETE FROM saved_mission');
  }).catch(() => undefined);
}

/** The saved mission, or null when there is none, it no longer fits the schema, or the device cannot read it. */
export async function loadSavedMission(): Promise<SavedMission | null> {
  try {
    await writes;
    const db = await database();
    const row = await db.getFirstAsync<{ mission_id: string; participation: string }>(
      'SELECT mission_id, participation FROM saved_mission WHERE id = 1',
    );
    if (!row) return null;
    const participation = OwnParticipation.safeParse(JSON.parse(row.participation));
    return participation.success ? { missionId: row.mission_id, participation: participation.data } : null;
  } catch {
    return null;
  }
}
