import type { Polygon } from 'geojson';
import { createDb } from '../db';
import { missions, participations, polygons, searchers } from '../db/schema';
import { loadEnv } from '../env';
import { createMission } from '../modules/missions/missions.service';

// Development data: a search in the Jerusalem hills, west of Ein Kerem. Run with `pnpm db:seed`.

const box = (west: number, south: number, east: number, north: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

try {
  const existing = await db.select({ id: missions.id }).from(missions).limit(1);
  if (existing.length > 0) {
    console.info('The database already has missions; nothing to seed. Reset it with: pnpm db:reset');
    process.exit(0);
  }

  const mission = await createMission(db, {
    name: 'מסע 0412',
    missingPerson: {
      name: 'נועם אברהם',
      age: 74,
      disappearedAt: '2026-10-03T11:20:00+03:00',
      description: 'מעיל חום, כובע צמר אפור, מקל הליכה',
      additionalInfo: null,
    },
    rallyPoint: { type: 'Point', coordinates: [35.1335, 31.7835] },
    lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
  });

  const [a, b, c] = await db
    .insert(polygons)
    .values([
      {
        missionId: mission.id,
        letter: 'A',
        name: 'ואדי צפוני',
        status: 'active',
        geometry: box(35.122, 31.77, 35.136, 31.781),
      },
      {
        missionId: mission.id,
        letter: 'B',
        name: 'חורשת אורנים',
        status: 'active',
        geometry: box(35.138, 31.77, 35.152, 31.781),
      },
      {
        missionId: mission.id,
        letter: 'C',
        name: 'צפון-מערב',
        status: 'completed',
        geometry: box(35.122, 31.756, 35.136, 31.768),
      },
      { missionId: mission.id, letter: 'D', name: 'מדרון דרומי', geometry: box(35.138, 31.756, 35.152, 31.768) },
    ])
    .returning({ id: polygons.id });
  if (!a || !b || !c) throw new Error('Seed polygons were not created');

  const people = await db
    .insert(searchers)
    .values([
      { phone: '+972500000001', name: 'דנה כהן' },
      { phone: '+972500000002', name: 'יואב לוי' },
      { phone: '+972500000003', name: 'אלון שגיא' },
      { phone: '+972500000004', name: 'מיכל פרץ' },
    ])
    .returning({ id: searchers.id });
  const [dana, yoav, alon, michal] = people;
  if (!dana || !yoav || !alon || !michal) throw new Error('Seed searchers were not created');

  const now = new Date();
  await db.insert(participations).values([
    {
      missionId: mission.id,
      searcherId: dana.id,
      callsign: 4,
      status: 'assigned',
      polygonId: a.id,
      taskStatus: 'searching',
      lastPosition: { type: 'Point', coordinates: [35.128, 31.775] },
      lastPositionAt: now,
    },
    {
      missionId: mission.id,
      searcherId: yoav.id,
      callsign: 3,
      status: 'assigned',
      polygonId: a.id,
      taskStatus: 'searching',
      lastPosition: { type: 'Point', coordinates: [35.1235, 31.7765] },
      lastPositionAt: now,
    },
    {
      missionId: mission.id,
      searcherId: alon.id,
      callsign: 7,
      status: 'assigned',
      polygonId: b.id,
      taskStatus: 'paused',
      lastPosition: { type: 'Point', coordinates: [35.145, 31.774] },
      lastPositionAt: now,
    },
    { missionId: mission.id, searcherId: michal.id, callsign: 9, status: 'available' },
  ]);

  console.info(`Seeded mission "${mission.name}" (join code ${mission.joinCode}).`);
} finally {
  await close();
}
