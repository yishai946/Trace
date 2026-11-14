import type { OwnParticipation, Report } from '@trace/schemas';

export const MISSION_ID = '00000000-0000-4000-8000-000000000001';
export const POLYGON_A = '00000000-0000-4000-8000-0000000000a1';
export const POLYGON_B = '00000000-0000-4000-8000-0000000000b2';

export const assigned: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 7,
  status: 'assigned',
  polygonId: POLYGON_A,
  taskStatus: 'searching',
};

let counter = 0;

/** A report sent by searcher 11 from polygon A at 16:44 (UTC), unless the overrides say otherwise. */
export function makeReport(overrides: Partial<Report> = {}): Report {
  counter += 1;
  const id = `0190a3b2-7c4e-7a10-8a5e-${String(counter).padStart(12, '0')}`;
  return {
    id,
    missionId: MISSION_ID,
    polygonId: POLYGON_A,
    type: 'hazard',
    status: 'new',
    text: 'מדרון חלק',
    position: { type: 'Point', coordinates: [35.0152, 31.7421] },
    accuracy: 6,
    reportedAt: '2026-10-03T16:44:00.000Z',
    reportedBy: { role: 'searcher', name: 'יוסי דהן', callsign: 11 },
    hasPhoto: false,
    photoUrl: null,
    createdAt: '2026-10-03T16:44:05.000Z',
    ...overrides,
  };
}
