import type { Mission, MissionPolygon, Participant } from '@trace/schemas';

/** Server data shared by the mission tests. */
export const mission: Mission = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'K7-4Q2',
  missingPerson: { name: 'נועם אברהם', age: 74, disappearedAt: null, description: null, additionalInfo: null },
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
