import type { Mission, MissionPolygon } from '@trace/schemas';

export const MISSION_ID = '00000000-0000-4000-8000-000000000001';

export const mission: Mission = {
  id: MISSION_ID,
  name: 'מסע 0412',
  status: 'active',
  joinCode: 'ABCD1234',
  missingPerson: {
    name: 'נועם',
    age: 9,
    disappearedAt: '2026-10-03T10:00:00.000Z',
    description: 'חולצה כחולה',
    additionalInfo: null,
    photoUrl: `/api/missions/${MISSION_ID}/photo?v=1`,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T10:05:00.000Z' },
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};

export const polygon: MissionPolygon = {
  id: '00000000-0000-4000-8000-0000000000a1',
  missionId: MISSION_ID,
  name: 'פוליגון 1',
  status: 'active',
  coverage: null,
  activeSearchers: 0,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [35, 31.7],
        [35.01, 31.7],
        [35.01, 31.71],
        [35, 31.7],
      ],
    ],
  },
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
};
