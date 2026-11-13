import { z } from 'zod';
import { ErrorCode } from './errors';
import { LngLat, PointGeometry } from './geo';
import { Message, MessageRecipient, OwnMessage } from './messages';
import { Lkp, Mission } from './missions';
import { Participant } from './participants';
import { MissionPolygon } from './polygons';
import { Sighting } from './sightings';
import { Sos } from './sos';
import { TimelineEvent } from './timeline';
import { TrackPoint } from './tracking';

/**
 * The realtime channel (Socket.IO) between the API and both apps. A client connects with its session (Command's cookie,
 * Field's token as `auth: { token }`), then joins each mission it shows. Events arrive only for joined missions, and
 * only those its role may see. After a reconnect the client joins again and refetches, since events sent while it was
 * away are not replayed.
 */
export const REALTIME_PATH = '/api/realtime';

export const JoinMissionRequest = z.object({ missionId: z.uuid() });

/** The answer to a join. A mission the user has no part in answers NOT_FOUND, like the REST routes. */
export const JoinMissionAck = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), code: ErrorCode }),
]);

/** A polygon was drawn, renamed or reshaped. Every member of the mission gets it. */
const PolygonSaved = z.object({ type: z.literal('polygon.saved'), missionId: z.uuid(), polygon: MissionPolygon });

/** A polygon left the active map. Every member of the mission gets it. */
const PolygonDeleted = z.object({ type: z.literal('polygon.deleted'), missionId: z.uuid(), polygonId: z.uuid() });

/**
 * The commander moved the rally point (UC-C05). Every member of the mission gets it; a searcher who is offline gets the
 * new point from `GET /missions/:id` when they reconnect (decision 92).
 */
const RallyChanged = z.object({
  type: z.literal('rally.changed'),
  missionId: z.uuid(),
  rallyPoint: PointGeometry,
  updatedAt: z.iso.datetime({ offset: true }),
});

/**
 * The commander edited the mission or missing-person details, or replaced the photo (UC-C03). Every member of the
 * mission gets the whole mission; a searcher who is offline gets it from `GET /missions/:id` when they reconnect.
 */
const MissionUpdated = z.object({ type: z.literal('mission.updated'), missionId: z.uuid(), mission: Mission });

/** A searcher reported a position. Only the mission's commander gets it: searchers do not see positions (decision 32). */
const ParticipantMoved = z.object({
  type: z.literal('participant.moved'),
  missionId: z.uuid(),
  participantId: z.uuid(),
  searcherId: z.uuid(),
  position: LngLat,
  positionAt: z.iso.datetime({ offset: true }),
});

/**
 * New points were added to a searcher's route (UC-C10): only the points stored by that upload, oldest first. Only the
 * mission's commander gets it (decision 32).
 */
const ParticipantTracked = z.object({
  type: z.literal('participant.tracked'),
  missionId: z.uuid(),
  participantId: z.uuid(),
  points: z.array(TrackPoint),
});

/** A searcher joined the mission (UC-F02). Only the mission's commander gets it, for the searcher pool (UC-C08). */
const ParticipantJoined = z.object({
  type: z.literal('participant.joined'),
  missionId: z.uuid(),
  participant: Participant,
});

/**
 * The commander assigned or moved a searcher (UC-C09). The commander and that searcher get it; other searchers do
 * not see who searches where (decision 32).
 */
const ParticipantUpdated = z.object({
  type: z.literal('participant.updated'),
  missionId: z.uuid(),
  participant: Participant,
});

/**
 * A sighting was added or decided. Only the mission's commander gets it: searchers' maps show the LKP, not sightings
 * (decisions 31, 32).
 */
const SightingSaved = z.object({ type: z.literal('sighting.saved'), missionId: z.uuid(), sighting: Sighting });

/**
 * The current LKP changed. Every member gets it at once; one who was offline gets it by refetching after reconnect
 * (decision 87).
 */
const LkpChanged = z.object({ type: z.literal('lkp.changed'), missionId: z.uuid(), lkp: Lkp });

/** An event was added to the mission's Timeline (UC-C19). Only the mission's commander gets it. */
const TimelineRecorded = z.object({ type: z.literal('timeline.recorded'), missionId: z.uuid(), event: TimelineEvent });

/** The commander sent a message (UC-C12). Only the mission's commander gets the whole message with its recipients. */
const MessageSent = z.object({ type: z.literal('message.sent'), missionId: z.uuid(), message: Message });

/**
 * A message reached one of its recipients' live connections. Only that searcher gets it, without the other recipients
 * (decision 32). One who was offline reads it from GET /missions/:id/participation/messages after reconnecting (decision 77).
 */
const MessageReceived = z.object({
  type: z.literal('message.received'),
  missionId: z.uuid(),
  searcherId: z.uuid(),
  message: OwnMessage,
});

/** A recipient's app reported delivery, reading or acknowledging. Only the mission's commander gets it. */
const MessageReceiptRecorded = z.object({
  type: z.literal('message.receipt'),
  missionId: z.uuid(),
  messageId: z.uuid(),
  recipient: MessageRecipient,
});

/**
 * An SOS was activated or closed (UC-F13, UC-C14). The whole SOS is sent. The commander, the sender and the searchers
 * it was sent to get it: those assigned to the sender's polygon at activation, and the same ones when it is closed
 * (decisions 98, 99). A client that was offline reads `GET /missions/:id/sos` after it reconnects.
 */
const SosSaved = z.object({ type: z.literal('sos.saved'), missionId: z.uuid(), sos: Sos });

/** Every event the server sends about a mission, on the `mission:event` channel. */
export const MissionEvent = z.discriminatedUnion('type', [
  PolygonSaved,
  PolygonDeleted,
  RallyChanged,
  MissionUpdated,
  ParticipantMoved,
  ParticipantTracked,
  ParticipantJoined,
  ParticipantUpdated,
  SightingSaved,
  LkpChanged,
  TimelineRecorded,
  MessageSent,
  MessageReceived,
  MessageReceiptRecorded,
  SosSaved,
]);

/** Event names and payloads, for typing both ends of the Socket.IO connection. */
export interface ServerToClientEvents {
  'mission:event': (event: MissionEvent) => void;
}

export interface ClientToServerEvents {
  'mission:join': (request: JoinMissionRequest, ack: (result: JoinMissionAck) => void) => void;
  'mission:leave': (request: JoinMissionRequest) => void;
}

export type JoinMissionRequest = z.infer<typeof JoinMissionRequest>;
export type JoinMissionAck = z.infer<typeof JoinMissionAck>;
export type MissionEvent = z.infer<typeof MissionEvent>;
