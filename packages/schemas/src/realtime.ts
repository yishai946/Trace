import { z } from 'zod';
import { ErrorCode } from './errors';
import { LngLat, PointGeometry } from './geo';
import { Mission } from './missions';
import { MissionPolygon } from './polygons';

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

/**
 * A searcher reported a position. Only the mission's commander and that searcher get it: searchers do not see each
 * other's positions (decision 32).
 */
const ParticipantMoved = z.object({
  type: z.literal('participant.moved'),
  missionId: z.uuid(),
  participantId: z.uuid(),
  searcherId: z.uuid(),
  position: LngLat,
  positionAt: z.iso.datetime({ offset: true }),
});

/** Every event the server sends about a mission, on the `mission:event` channel. */
export const MissionEvent = z.discriminatedUnion('type', [
  PolygonSaved,
  PolygonDeleted,
  RallyChanged,
  MissionUpdated,
  ParticipantMoved,
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
