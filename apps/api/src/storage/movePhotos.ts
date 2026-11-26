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
 * Safe to run again and while the server is up: a photo is served from its row until it is cleared. A row that still
 * has `data` was not replaced by an upload (an upload clears it), so its bytes are the photo and win over any object
 * under the key. A concurrent upload writes another version's key, so neither overwrites the other. Returns how many it
 * moved.
 */
export async function movePhotos(db: Db, photos: PhotoStorage): Promise<number> {
  let moved = 0;
  for (const { table, idColumn, keyOf } of TABLES) {
    const ids = await db.execute<{ id: string }>(
      sql`select ${sql.identifier(idColumn)} as id from ${sql.identifier(table)} where data is not null`,
    );
    for (const { id } of ids) {
      await db.transaction(async (tx) => {
        const [row] = await tx.execute<{ content_type: string; data: Buffer | null; updated_at: string }>(
          sql`select content_type, data, updated_at from ${sql.identifier(table)} where ${sql.identifier(idColumn)} = ${id} for update`,
        );
        if (!row?.data) return;
        await photos.put(keyOf(id, new Date(row.updated_at)), { contentType: row.content_type, data: row.data });
        await tx.execute(
          sql`update ${sql.identifier(table)} set data = null where ${sql.identifier(idColumn)} = ${id}`,
        );
        moved += 1;
      });
    }
  }
  return moved;
}
