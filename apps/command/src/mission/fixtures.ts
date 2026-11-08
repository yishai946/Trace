import type { Mission, MissionPolygon, Participant, TimelineEvent, TimelineSubject } from '@trace/schemas';
import type { TimelineEventType } from '@trace/domain';

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

const commanderActor = { kind: 'commander', userId: '00000000-0000-4000-8000-000000000201', name: 'מנהל' } as const;
const searcher07 = {
  kind: 'searcher',
  participantId: '00000000-0000-4000-8000-000000000007',
  callsign: 7,
  name: 'אלון שגיא',
} as const;
const subjectOf = (
  kind: TimelineSubject['kind'],
  label: string | null,
  id = '00000000-0000-4000-8000-0000000000f1',
  callsign: number | null = null,
): TimelineSubject => ({ kind, id, label, callsign });

/** One event of every type, as the API returns them. */
export const eventSamples: Record<TimelineEventType, TimelineEvent> = {
  'mission.created': {
    id: '00000000-0000-4000-8000-000000000301',
    missionId: mission.id,
    occurredAt: '2026-10-03T10:00:00.000Z',
    type: 'mission.created',
    actor: commanderActor,
    subject: subjectOf('mission', 'מסע 0412', mission.id),
    details: {},
  },
  'mission.paused': {
    id: '00000000-0000-4000-8000-000000000302',
    missionId: mission.id,
    occurredAt: '2026-10-03T11:00:00.000Z',
    type: 'mission.paused',
    actor: commanderActor,
    subject: subjectOf('mission', 'מסע 0412', mission.id),
    details: {},
  },
  'mission.resumed': {
    id: '00000000-0000-4000-8000-000000000303',
    missionId: mission.id,
    occurredAt: '2026-10-03T11:30:00.000Z',
    type: 'mission.resumed',
    actor: commanderActor,
    subject: subjectOf('mission', 'מסע 0412', mission.id),
    details: {},
  },
  'mission.ended': {
    id: '00000000-0000-4000-8000-000000000304',
    missionId: mission.id,
    occurredAt: '2026-10-03T17:52:00.000Z',
    type: 'mission.ended',
    actor: commanderActor,
    subject: subjectOf('mission', 'מסע 0412', mission.id),
    details: { outcome: 'located' },
  },
  'lkp.changed': {
    id: '00000000-0000-4000-8000-000000000305',
    missionId: mission.id,
    occurredAt: '2026-10-03T10:01:00.000Z',
    type: 'lkp.changed',
    actor: commanderActor,
    subject: subjectOf('lkp', null),
    details: { observedAt: '2026-10-03T10:05:00.000Z', previousObservedAt: null },
  },
  'polygon.created': {
    id: '00000000-0000-4000-8000-000000000306',
    missionId: mission.id,
    occurredAt: '2026-10-03T10:20:00.000Z',
    type: 'polygon.created',
    actor: commanderActor,
    subject: subjectOf('polygon', 'ואדי צפוני', polygonA.id),
    details: {},
  },
  'polygon.boundary_changed': {
    id: '00000000-0000-4000-8000-000000000307',
    missionId: mission.id,
    occurredAt: '2026-10-03T10:40:00.000Z',
    type: 'polygon.boundary_changed',
    actor: commanderActor,
    subject: subjectOf('polygon', 'ואדי צפוני', polygonA.id),
    details: { searchersOutside: 0 },
  },
  'polygon.deleted': {
    id: '00000000-0000-4000-8000-000000000308',
    missionId: mission.id,
    occurredAt: '2026-10-03T12:00:00.000Z',
    type: 'polygon.deleted',
    actor: commanderActor,
    subject: subjectOf('polygon', 'פוליגון 2', polygonB.id),
    details: {},
  },
  'search.started': {
    id: '00000000-0000-4000-8000-000000000309',
    missionId: mission.id,
    occurredAt: '2026-10-03T12:10:00.000Z',
    type: 'search.started',
    actor: searcher07,
    subject: subjectOf('polygon', 'חורשת אורנים', polygonA.id),
    details: {},
  },
  'report.submitted': {
    id: '00000000-0000-4000-8000-00000000030a',
    missionId: mission.id,
    occurredAt: '2026-10-03T12:30:00.000Z',
    type: 'report.submitted',
    actor: searcher07,
    subject: subjectOf('report', 'מפגע, מדרון חלק'),
    details: {},
  },
  'coverage.threshold_reached': {
    id: '00000000-0000-4000-8000-00000000030b',
    missionId: mission.id,
    occurredAt: '2026-10-03T13:00:00.000Z',
    type: 'coverage.threshold_reached',
    actor: { kind: 'system' },
    subject: subjectOf('polygon', 'ואדי צפוני', polygonA.id),
    details: { threshold: 80 },
  },
  'contact.lost': {
    id: '00000000-0000-4000-8000-00000000030c',
    missionId: mission.id,
    occurredAt: '2026-10-03T13:30:00.000Z',
    type: 'contact.lost',
    actor: { kind: 'system' },
    subject: subjectOf('participant', 'אלון שגיא', searcher07.participantId, 7),
    details: {},
  },
  'sos.activated': {
    id: '00000000-0000-4000-8000-00000000030d',
    missionId: mission.id,
    occurredAt: '2026-10-03T13:58:00.000Z',
    type: 'sos.activated',
    actor: searcher07,
    subject: subjectOf('sos', 'חורשת אורנים'),
    details: {},
  },
};

/** A short mission history, oldest first, as the API returns it. */
export const timelineEvents: TimelineEvent[] = [
  eventSamples['mission.created'],
  eventSamples['lkp.changed'],
  eventSamples['polygon.created'],
  eventSamples['polygon.boundary_changed'],
  eventSamples['sos.activated'],
];
