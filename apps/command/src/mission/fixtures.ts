import type { LkpPoint, Mission, MissionPolygon, Participant, Sighting } from '@trace/schemas';

/** Server data shared by the mission tests. */
export const mission: Mission = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: {
    name: 'נועם אברהם',
    age: 74,
    disappearedAt: null,
    description: null,
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.1335, 31.7835] },
  lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T10:05:00.000Z' },
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};

export const polygonA: MissionPolygon = {
  id: '00000000-0000-4000-8000-0000000000a1',
  missionId: mission.id,
  name: 'ואדי צפוני',
  status: 'active',
  coverage: null,
  activeSearchers: 1,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [35.122, 31.77],
        [35.136, 31.77],
        [35.136, 31.781],
        [35.122, 31.781],
        [35.122, 31.77],
      ],
    ],
  },
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};

export const polygonB: MissionPolygon = {
  ...polygonA,
  id: '00000000-0000-4000-8000-0000000000b1',
  name: 'פוליגון 2',
  status: 'unassigned',
  activeSearchers: 0,
};

export const participants: Participant[] = [
  {
    id: '00000000-0000-4000-8000-000000000004',
    searcherId: '00000000-0000-4000-8000-000000000104',
    name: 'דנה כהן',
    callsign: 4,
    status: 'assigned',
    polygonId: polygonA.id,
    taskStatus: 'searching',
    position: [35.128, 31.775],
    positionAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000009',
    searcherId: '00000000-0000-4000-8000-000000000109',
    name: 'מיכל פרץ',
    callsign: 9,
    status: 'available',
    polygonId: null,
    taskStatus: null,
    position: null,
    positionAt: null,
  },
];

/** The mission's LKP history, newest first: the current LKP (13:05 Israel time) and the one it replaced (12:10). */
export const lkps: LkpPoint[] = [
  {
    id: '00000000-0000-4000-8000-0000000001c2',
    position: { type: 'Point', coordinates: [35.137, 31.769] },
    observedAt: '2026-10-03T10:05:00.000Z',
    current: true,
    sightingId: null,
    setBy: 'ישי',
    createdAt: '2026-10-03T10:08:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-0000000001c1',
    position: { type: 'Point', coordinates: [35.1398, 31.7398] },
    observedAt: '2026-10-03T09:10:00.000Z',
    current: false,
    sightingId: null,
    setBy: 'ישי',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
];

const commander = { role: 'commander' as const, name: 'ישי', callsign: null };

/** A witness sighting at 14:22 Israel time, later than the LKP, so TRACE suggests it. */
export const sightingA: Sighting = {
  id: '00000000-0000-4000-8000-0000000005a1',
  missionId: mission.id,
  number: 1,
  position: { type: 'Point', coordinates: [35.1412, 31.7745] },
  observedAt: '2026-10-03T11:22:00.000Z',
  description: 'מטייל ראה אדם עם כובע אפור',
  source: 'witness',
  reportedBy: commander,
  lkpDecision: null,
  lkpCandidate: true,
  createdAt: '2026-10-03T11:30:00.000Z',
};

/** The commander's own sighting at 16:02 that they rejected as the LKP. */
export const sightingB: Sighting = {
  ...sightingA,
  id: '00000000-0000-4000-8000-0000000005b1',
  number: 2,
  position: { type: 'Point', coordinates: [35.1441, 31.7712] },
  observedAt: '2026-10-03T13:02:00.000Z',
  description: null,
  source: 'self',
  lkpDecision: 'rejected',
  lkpCandidate: false,
  createdAt: '2026-10-03T13:10:00.000Z',
};
