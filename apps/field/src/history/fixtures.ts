import type { Mission, OwnActivity } from '@trace/schemas';
import { makeReport } from '../reports/fixtures';

export const ENDED_ID = '00000000-0000-4000-8000-0000000000e1';
export const ACTIVE_ID = '00000000-0000-4000-8000-0000000000a9';
const STOPPED_ID = '00000000-0000-4000-8000-0000000000e2';

const base: Mission = {
  id: ENDED_ID,
  name: 'מסע 0371',
  status: 'ended_located',
  joinCode: 'ABC123',
  commander: { name: 'רונית', phoneNumber: '+972501234567' },
  missingPerson: {
    name: 'מאיר חדד',
    age: 68,
    disappearedAt: null,
    description: null,
    additionalInfo: null,
    photoUrl: null,
  },
  rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
  lkp: null,
  located: {
    position: { type: 'Point', coordinates: [35.13, 31.78] },
    locatedAt: '2026-09-14T09:00:00.000Z',
    note: null,
    endedAt: '2026-09-14T09:10:00.000Z',
  },
  stopped: null,
  createdAt: '2026-09-14T04:00:00.000Z',
  updatedAt: '2026-09-14T09:10:00.000Z',
};

export const endedLocated = base;
export const endedStopped: Mission = {
  ...base,
  id: STOPPED_ID,
  name: 'מסע 0329',
  status: 'ended_stopped',
  missingPerson: { ...base.missingPerson, name: 'רועי גולן', age: 31 },
  located: null,
  stopped: { reason: 'weather', note: null, endedAt: '2026-08-21T12:00:00.000Z' },
};
export const active: Mission = { ...base, id: ACTIVE_ID, name: 'מסע 0412', status: 'active', located: null };

export const activity: OwnActivity = {
  callsign: 4,
  joinedAt: '2026-09-14T05:00:00.000Z',
  status: 'ended',
  taskStatus: 'finished',
  polygon: { id: '00000000-0000-4000-8000-0000000000b1', name: 'A' },
  reports: [makeReport({ text: 'מדרון חלק' })],
  sightings: [
    {
      id: '00000000-0000-4000-8000-0000000000c1',
      missionId: ENDED_ID,
      number: 2,
      position: { type: 'Point', coordinates: [35.1, 31.7] },
      observedAt: '2026-09-14T07:00:00.000Z',
      description: 'חולצה כחולה',
      source: 'self',
      reportedBy: { role: 'searcher', name: 'דנה', callsign: 4 },
      lkpDecision: null,
      lkpCandidate: false,
      createdAt: '2026-09-14T07:01:00.000Z',
    },
  ],
};
