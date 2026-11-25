import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import type { PhotoStorage } from '.';
import { missionPhotoKey, reportPhotoKey } from '.';

const TABLES = [
  { table: 'mission_photos', idColumn: 'mission_id', keyOf: missionPhotoKey },
  { table: 'report_photos', idColumn: 'report_id', keyOf: reportPhotoKey },
];

/**
 * Copies photos saved in the database before the bucket (their `data` column) into the bucket, then clears `data`.
 * Safe to run again and while the server is up: a photo is served from its row until it is cleared, and one that is
 * already in the bucket was uploaded after the move began, so it is newer and is kept. Returns how many it moved.
 * shortcut: a photo uploaded in the instant between the bucket check and the copy is overwritten by the older one;
 * run it once, right after the release that serves from the bucket, when uploads are rare.
 */
export async function movePhotos(db: Db, photos: PhotoStorage): Promise<number> {
  let moved = 0;
  for (const { table, idColumn, keyOf } of TABLES) {
    const ids = await db.execute<{ id: string }>(
      sql`select ${sql.identifier(idColumn)} as id from ${sql.identifier(table)} where data is not null`,
    );
    for (const { id } of ids) {
      await db.transaction(async (tx) => {
        const [row] = await tx.execute<{ content_type: string; data: Buffer | null }>(
          sql`select content_type, data from ${sql.identifier(table)} where ${sql.identifier(idColumn)} = ${id} for update`,
        );
        if (!row?.data) return;
        const key = keyOf(id);
        if (!(await photos.get(key))) await photos.put(key, { contentType: row.content_type, data: row.data });
        await tx.execute(
          sql`update ${sql.identifier(table)} set data = null where ${sql.identifier(idColumn)} = ${id}`,
        );
        moved += 1;
      });
    }
  }
  return moved;
}
