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
import { actorOf, searcherOf } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { getOwnParticipation, listParticipants, previewJoin } from './participants.read';
import { pauseOrResumeSearch, startSearch } from './participants.search';
import { assignParticipant, endParticipation, joinMission, setBattery, setGpsStatus } from './participants.service';

export const participantRoutes: FastifyPluginAsyncZod<ServiceDeps> = async (app, deps) => {
  const { db } = deps;
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
    (request) => listParticipants(deps, request.params.missionId),
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
      const { searcherId } = searcherOf(request);
      return getOwnParticipation(db, request.params.missionId, searcherId);
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
      const { searcherId } = searcherOf(request);
      const { missionId } = request.params;
      await setGpsStatus(deps, { missionId, searcherId, available: request.body.available });
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
      const { searcherId } = searcherOf(request);
      const { missionId } = request.params;
      await setBattery(deps, { missionId, searcherId, ...request.body });
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/missions/:missionId/participation/search/start',
    {
      schema: {
        tags: ['participants'],
        summary: 'Start the search: the assigned task goes from Ready to Searching (UC-F06)',
        description:
          'Searchers in the mission only. The commander sees the change at once. Sending it again while searching ' +
          'changes nothing. 409 NOT_ASSIGNED without a polygon, TASK_NOT_READY when the task is paused or ' +
          'finished, MISSION_NOT_ACTIVE while the mission is paused, MISSION_ENDED, PARTICIPATION_ENDED. The ' +
          'phone checks the offline package and the permissions itself (decisions 73, 85).',
        params: MissionParams,
        response: { 200: OwnParticipation, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) => startSearch(deps, { missionId: request.params.missionId, searcherId: searcherOf(request).searcherId }),
  );

  for (const action of ['pause', 'resume'] as const) {
    app.post(
      `/missions/:missionId/participation/search/${action}`,
      {
        schema: {
          tags: ['participants'],
          summary:
            action === 'pause'
              ? 'Pause the search: Searching becomes Paused (UC-F07)'
              : 'Resume the search: Paused becomes Searching (UC-F07)',
          description:
            'Searchers in the mission only. Safety tracking goes on; points taken while paused do not count toward ' +
            'Coverage (decision 71). The commander sees the change at once. Sending it again changes nothing. ' +
            `409 ${action === 'pause' ? 'TASK_NOT_SEARCHING' : 'TASK_NOT_PAUSED'} for a task in another status, ` +
            'MISSION_NOT_ACTIVE while the mission is paused (a mission Pause outranks a personal one), NOT_ASSIGNED, ' +
            'MISSION_ENDED, PARTICIPATION_ENDED.',
          params: MissionParams,
          response: {
            200: OwnParticipation,
            400: ApiError,
            401: ApiError,
            403: ApiError,
            404: ApiError,
            409: ApiError,
          },
        },
        preHandler: [searchersOnly, missionAccess(db, 'member')],
      },
      (request) =>
        pauseOrResumeSearch(deps, {
          missionId: request.params.missionId,
          searcherId: searcherOf(request).searcherId,
          action,
        }),
    );
  }

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
      return assignParticipant(deps, {
        missionId,
        participantId,
        polygonId: request.body.polygonId,
        commanderId: actorOf(request).userId,
      });
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
    (request) => endParticipation(deps, request.params),
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
      const { searcherId } = searcherOf(request);
      const { joined, mission, participation } = await joinMission(deps, searcherId, request.params.code);
      return reply.status(joined ? 201 : 200).send({ mission, participation });
    },
  );
};
