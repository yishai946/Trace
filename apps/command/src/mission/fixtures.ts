import type {
  LkpPoint,
  Message,
  MessageRecipient,
  Mission,
  MissionPolygon,
  Participant,
  Sighting,
  TimelineEvent,
  TimelineSubject,
} from '@trace/schemas';
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
    phone: '+972526114085',
    callsign: 4,
    status: 'assigned',
    polygonId: polygonA.id,
    taskStatus: 'searching',
    position: [35.128, 31.775],
    positionAt: '2026-10-03T12:00:00.000Z',
    gpsUnavailableSince: null,
    battery: null,
  },
  {
    id: '00000000-0000-4000-8000-000000000009',
    searcherId: '00000000-0000-4000-8000-000000000109',
    name: 'מיכל פרץ',
    phone: '+972503371602',
    callsign: 9,
    status: 'available',
    polygonId: null,
    taskStatus: null,
    position: null,
    positionAt: null,
    gpsUnavailableSince: null,
    battery: null,
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

/** A searcher's own sighting at 16:58 Israel time (UC-F10): later than the LKP and sightingA, so TRACE suggests it. */
export const sightingC: Sighting = {
  ...sightingA,
  id: '00000000-0000-4000-8000-0000000005c1',
  number: 3,
  position: { type: 'Point', coordinates: [35.1412, 31.7745] },
  observedAt: '2026-10-03T13:58:00.000Z',
  description: null,
  source: 'self',
  reportedBy: { role: 'searcher', name: 'אלון שגיא', callsign: 7 },
  lkpDecision: null,
  lkpCandidate: true,
  createdAt: '2026-10-03T14:00:00.000Z',
};

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

const recipientOf = (
  callsign: number,
  name: string,
  times: Pick<MessageRecipient, 'deliveredAt' | 'readAt' | 'acknowledgedAt'>,
): MessageRecipient => ({
  participantId: `00000000-0000-4000-8000-00000000000${callsign}`,
  searcherId: `00000000-0000-4000-8000-00000000010${callsign}`,
  callsign,
  name,
  status: times.acknowledgedAt ? 'acknowledged' : times.readAt ? 'read' : 'sent',
  ...times,
});

/** A normal message to polygonA at 16:35 Israel time: one recipient read it, the other has not received it. */
export const messageNormal: Message = {
  id: '00000000-0000-4000-8000-0000000007a1',
  missionId: mission.id,
  urgency: 'normal',
  body: 'חזרו לכינוס בנקודת הריכוז',
  target: { kind: 'polygons', polygons: [{ id: polygonA.id, name: polygonA.name }] },
  sentAt: '2026-10-03T13:35:00.000Z',
  recipients: [
    recipientOf(4, 'דנה כהן', {
      deliveredAt: '2026-10-03T13:35:05.000Z',
      readAt: '2026-10-03T13:36:00.000Z',
      acknowledgedAt: null,
    }),
    recipientOf(5, 'רון לוי', { deliveredAt: null, readAt: null, acknowledgedAt: null }),
  ],
};

/** A critical message to the whole mission at 17:10: acknowledged, read, and delivered but not read. */
export const messageCritical: Message = {
  id: '00000000-0000-4000-8000-0000000007b1',
  missionId: mission.id,
  urgency: 'critical',
  body: 'מזג האוויר מתדרדר, יש לצאת מהשטח',
  target: { kind: 'mission' },
  sentAt: '2026-10-03T14:10:00.000Z',
  recipients: [
    recipientOf(4, 'דנה כהן', {
      deliveredAt: '2026-10-03T14:10:05.000Z',
      readAt: '2026-10-03T14:11:00.000Z',
      acknowledgedAt: '2026-10-03T14:12:00.000Z',
    }),
    recipientOf(7, 'אלון שגיא', {
      deliveredAt: '2026-10-03T14:10:06.000Z',
      readAt: '2026-10-03T14:13:00.000Z',
      acknowledgedAt: null,
    }),
    recipientOf(9, 'מיכל פרץ', {
      deliveredAt: '2026-10-03T14:10:07.000Z',
      readAt: null,
      acknowledgedAt: null,
    }),
  ],
};

/** A message to one searcher, read. */
export const messageToOne: Message = {
  id: '00000000-0000-4000-8000-0000000007c1',
  missionId: mission.id,
  urgency: 'important',
  body: 'בדקו קשר',
  target: { kind: 'searcher', participantId: '00000000-0000-4000-8000-000000000009', callsign: 9, name: 'מיכל פרץ' },
  sentAt: '2026-10-03T12:00:00.000Z',
  recipients: [
    recipientOf(9, 'מיכל פרץ', {
      deliveredAt: '2026-10-03T12:00:05.000Z',
      readAt: '2026-10-03T12:01:00.000Z',
      acknowledgedAt: null,
    }),
  ],
};
