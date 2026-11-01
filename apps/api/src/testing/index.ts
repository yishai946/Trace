import { sql } from 'drizzle-orm';
import { buildApp } from '../app';
import { createDb, type Db } from '../db';
import { loadEnv } from '../env';
import { participations, searchers } from '../db/schema';
import { TEST_DATABASE_URL } from './testing.config';

/** Builds the app on the test database. Call `close` in `afterAll`. */
export async function createTestApp() {
  const database = createDb(TEST_DATABASE_URL);
  const app = await buildApp({
    env: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: TEST_DATABASE_URL }),
    db: database.db,
  });
  return {
    app,
    db: database.db,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

/** Empties every table between tests. */
export async function resetDb(db: Db) {
  await db.execute(sql`truncate missions, lkp_points, polygons, searchers, participations restart identity cascade`);
}

let phoneCounter = 0;

/** Adds a searcher to a mission, optionally assigned to a polygon at a position. */
export async function addParticipant(
  db: Db,
  options: { missionId: string; callsign: number; polygonId?: string; position?: [number, number] },
) {
  phoneCounter += 1;
  const [searcher] = await db
    .insert(searchers)
    .values({ phone: `+9725000000${phoneCounter}`, name: `מחפש ${options.callsign}` })
    .returning({ id: searchers.id });
  if (!searcher) throw new Error('Searcher insert returned no row');
  const [participation] = await db
    .insert(participations)
    .values({
      missionId: options.missionId,
      searcherId: searcher.id,
      callsign: options.callsign,
      status: options.polygonId ? 'assigned' : 'available',
      polygonId: options.polygonId ?? null,
      taskStatus: options.polygonId ? 'searching' : null,
      lastPosition: options.position ? { type: 'Point', coordinates: options.position } : null,
      lastPositionAt: options.position ? new Date() : null,
    })
    .returning({ id: participations.id });
  if (!participation) throw new Error('Participation insert returned no row');
  return participation.id;
}
