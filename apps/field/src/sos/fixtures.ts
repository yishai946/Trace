import type { Sos } from '@trace/schemas';

export const SOS_ID = '00000000-0000-4000-8000-0000000005a1';
export const OWN_PARTICIPANT_ID = '00000000-0000-4000-8000-000000000002';

/** An active SOS sent by the signed-in searcher (participant 0002, callsign 7) at 16:59 (UTC). */
export function makeSos(overrides: Partial<Sos> = {}): Sos {
  return {
    id: SOS_ID,
    missionId: '00000000-0000-4000-8000-000000000001',
    status: 'active',
    sender: {
      participantId: OWN_PARTICIPANT_ID,
      searcherId: '00000000-0000-4000-8000-0000000000c3',
      callsign: 7,
      name: 'דנה כהן',
    },
    polygon: { id: '00000000-0000-4000-8000-0000000000a1', name: 'A' },
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
