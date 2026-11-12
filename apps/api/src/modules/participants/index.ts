import {
  ApiError,
  AssignBody,
  BatteryBody,
  GpsStatusBody,
  JoinedMission,
  JoinParams,
  JoinPreview,
  MissionParams,
  OwnParticipation,
  Participant,
  ParticipantList,
  ParticipantParams,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { forbidden } from '../../errors';
import type { Realtime } from '../../realtime';
import { getMission } from '../missions/missions.service';
import { listPolygons } from '../polygons/polygons.service';
import {
  assignParticipant,
  endParticipation,
  getOwnParticipation,
  joinMission,
  listParticipants,
  previewJoin,
  setBattery,
  setGpsStatus,
} from './participants.service';

export const participantRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (
  app,
  { db, realtime },
) => {
  app.get(
    '/missions/:missionId/participants',
    {
      schema: {
        tags: ['participants'],
        summary: 'List the searchers in a mission with their assignment and last position',
        description: "Commander only: searchers do not see each other's positions (UC-F04).",
        params: MissionParams,
        response: { 200: ParticipantList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    (request) => listParticipants(db, request.params.missionId),
  );

  app.get(
    '/missions/:missionId/participation',
    {
      schema: {
        tags: ['participants'],
        summary: "The signed-in searcher's own participation: callsign, assignment and task (UC-F05)",
        description: 'Searchers in the mission only. Field reads it again after a lost connection.',
        params: MissionParams,
        response: { 200: OwnParticipation, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      return getOwnParticipation(db, request.params.missionId, actor.searcherId);
    },
  );

  app.put(
    '/missions/:missionId/participation/gps',
    {
      schema: {
        tags: ['participants'],
        summary: "Report whether the searcher's phone has GPS (UC-S01, decision 42)",
        description:
          'Searchers in the mission only. The commander sees "GPS unavailable" at once; a track upload clears it. ' +
          'The time before escalating is TBD and belongs to UC-S04.',
        params: MissionParams,
        body: GpsStatusBody,
        response: { 204: z.null(), 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request, reply) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId } = request.params;
      const participant = await setGpsStatus(db, {
        missionId,
        searcherId: actor.searcherId,
        available: request.body.available,
      });
      if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
      return reply.status(204).send(null);
    },
  );

  app.put(
    '/missions/:missionId/participation/battery',
    {
      schema: {
        tags: ['participants'],
        summary: "Report the searcher's phone battery (UC-C10, decision 13)",
        description:
          'Searchers in the mission only. `level` is a whole percent and `measuredAt` when the phone read it: the ' +
          'newest reading wins, so an older one arriving late changes nothing. The commander sees the change at once. ' +
          '409 PARTICIPATION_ENDED after Finish Activity. The low-battery threshold is TBD (decision 45).',
        params: MissionParams,
        body: BatteryBody,
        response: { 204: z.null(), 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request, reply) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId } = request.params;
      const participant = await setBattery(db, { missionId, searcherId: actor.searcherId, ...request.body });
      if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
      return reply.status(204).send(null);
    },
  );

  app.put(
    '/missions/:missionId/participants/:participantId/assignment',
    {
      schema: {
        tags: ['participants'],
        summary: 'Assign a searcher to a polygon, or move them to another one (UC-C09)',
        description:
          'The mission commander only (decision 7). A move ends the previous assignment, kept in the history, and ' +
          'starts a new search task at Ready (decision 28). Assigning to the same polygon again changes nothing. ' +
          'An unassigned polygon becomes active. 404 POLYGON_NOT_FOUND for a polygon not on the map; 409 ' +
          'MISSION_ENDED or PARTICIPATION_ENDED.',
        params: ParticipantParams,
        body: AssignBody,
        response: { 200: Participant, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => {
      const { missionId, participantId } = request.params;
      const { participant, activatedPolygonId } = await assignParticipant(db, {
        missionId,
        participantId,
        polygonId: request.body.polygonId,
        commanderId: actorOf(request).userId,
      });
      realtime.publish({ type: 'participant.updated', missionId, participant });
      const polygon =
        activatedPolygonId && (await listPolygons(db, missionId)).find((p) => p.id === activatedPolygonId);
      if (polygon) realtime.publish({ type: 'polygon.saved', missionId, polygon });
      return participant;
    },
  );

  app.post(
    '/missions/:missionId/participants/:participantId/end',
    {
      schema: {
        tags: ['participants'],
        summary: "End a searcher's participation: Activity Ended (UC-C18)",
        description:
          'The mission commander only. An active search task and the open assignment end; the route and what the ' +
          'searcher collected stay. The searcher is told at once and may join the active mission again later.',
        params: ParticipantParams,
        response: { 200: Participant, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => {
      const { missionId } = request.params;
      const participant = await endParticipation(db, request.params);
      realtime.publish({ type: 'participant.updated', missionId, participant });
      return participant;
    },
  );

  app.get(
    '/join/:code',
    {
      schema: {
        tags: ['participants'],
        summary: 'Look up the mission of a join code before joining it (UC-F02)',
        description: 'Searchers only. The code comes from the QR, the join link or is typed by hand (decision 6).',
        params: JoinParams,
        response: { 200: JoinPreview, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: searchersOnly,
    },
    (request) => previewJoin(db, request.params.code),
  );

  app.post(
    '/join/:code',
    {
      schema: {
        tags: ['participants'],
        summary: 'Join the mission of a join code as an available searcher (UC-F02)',
        description:
          'Searchers only. 201 when the searcher became available now: a new participation, or one that had ended ' +
          '(it keeps its callsign). 200 with the unchanged participation when the searcher already takes part ' +
          '(decision 69). 409 MISSION_NOT_ACTIVE for anyone else when the mission is paused or ended (decision 82); ' +
          '409 MISSION_FULL when every callsign is taken.',
        params: JoinParams,
        response: {
          200: JoinedMission,
          201: JoinedMission,
          400: ApiError,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
        },
      },
      preHandler: searchersOnly,
    },
    async (request, reply) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { searcherId } = actor;
      const { missionId, participation, joined } = await joinMission(db, searcherId, request.params.code);
      if (joined) {
        const participant = (await listParticipants(db, missionId)).find((p) => p.id === participation.id);
        if (participant) realtime.publish({ type: 'participant.joined', missionId, participant });
      }
      return reply.status(joined ? 201 : 200).send({ mission: await getMission(db, missionId), participation });
    },
  );
};
