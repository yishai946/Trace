import type { Mission, Report, Sos } from '@trace/schemas';

export const MISSION_ID = '00000000-0000-4000-8000-000000000001';
const POLYGON_ID = '00000000-0000-4000-8000-0000000000a1';

let counter = 0;

/** A report sent by searcher 11 from polygon A at 16:44 (UTC), unless the overrides say otherwise. */
export function makeReport(overrides: Partial<Report> = {}): Report {
  counter += 1;
  const id = `0190a3b2-7c4e-7a10-8a5e-${String(counter).padStart(12, '0')}`;
  return {
    id,
    missionId: MISSION_ID,
    polygonId: POLYGON_ID,
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

/** An active SOS sent by participant 0002 (callsign 7) at 16:59 (UTC), unless the overrides say otherwise. */
export function makeSos(overrides: Partial<Sos> = {}): Sos {
  return {
    id: '00000000-0000-4000-8000-0000000005a1',
    missionId: MISSION_ID,
    status: 'active',
    sender: {
      participantId: '00000000-0000-4000-8000-000000000002',
      searcherId: '00000000-0000-4000-8000-0000000000c3',
      callsign: 7,
      name: 'דנה כהן',
    },
    polygon: { id: POLYGON_ID, name: 'A' },
    message: null,
    location: {
      position: { type: 'Point', coordinates: [35.0098, 31.7452] },
      recordedAt: '2026-10-03T16:59:00.000Z',
      accuracy: 5,
    },
    recipientCount: 2,
    activatedAt: '2026-10-03T16:59:00.000Z',
    closedAt: null,
    closedBy: null,
    ...overrides,
  };
}

/** An active mission with an LKP-less map and a rally point, unless the overrides say otherwise. */
export function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: MISSION_ID,
    name: 'מסע 0412',
    status: 'active',
    joinCode: 'K7-4Q2',
    commander: { name: 'ישי', phoneNumber: null },
    missingPerson: {
      name: 'נועם אברהם',
      age: 74,
      disappearedAt: null,
      description: null,
      additionalInfo: null,
      photoUrl: null,
    },
    rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
    lkp: null,
    located: null,
    createdAt: '2026-11-06T10:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  };
}
