import {
  ApiError,
  CreateSightingBody,
  LkpDecisionBody,
  LkpDecisionResult,
  LkpPointList,
  MissionParams,
  Sighting,
  SightingList,
  SightingParams,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import { forbidden } from '../../errors';
import type { Db } from '../../db';
import type { Realtime } from '../../realtime';
import { createSighting, decideLkp, listLkps, listSightings } from './sightings.service';

export const sightingRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (app, { db, realtime }) => {
  app.get(
    '/missions/:missionId/sightings',
    {
      schema: {
        tags: ['sightings'],
        summary: 'List the mission’s sightings, oldest first (UC-C04)',
        params: MissionParams,
        response: { 200: SightingList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    (request) => listSightings(db, request.params.missionId),
  );

  app.post(
    '/missions/:missionId/sightings',
    {
      schema: {
        tags: ['sightings'],
        summary: 'Add a sighting (UC-C04, UC-F10)',
        description:
          'The mission’s commander or a searcher who still takes part in it. A sighting never becomes the LKP by ' +
          'itself; `lkpCandidate` tells whether TRACE suggests it. Sending the same `id` again returns the saved ' +
          'sighting with 200. Returns 409 MISSION_ENDED, PARTICIPATION_ENDED or SIGHTING_ID_TAKEN (the id belongs ' +
          'to another reporter or mission).',
        params: MissionParams,
        body: CreateSightingBody,
        response: {
          200: Sighting,
          201: Sighting,
          400: ApiError,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
        },
      },
      preHandler: missionAccess(db, 'member'),
    },
    async (request, reply) => {
      const { missionId } = request.params;
      const actor = actorOf(request);
      if (actor.role === 'searcher' && actor.searcherId === null) throw forbidden();
      const { sighting, created } = await createSighting(db, {
        ...request.body,
        missionId,
        reportedBy: actor.userId,
        searcherId: actor.role === 'searcher' ? actor.searcherId : null,
      });
      if (created) realtime.publish({ type: 'sighting.saved', missionId, sighting });
      return reply.status(created ? 201 : 200).send(sighting);
    },
  );

  app.put(
    '/missions/:missionId/sightings/:sightingId/lkp-decision',
    {
      schema: {
        tags: ['sightings'],
        summary: 'Accept or reject making a sighting the new LKP (UC-C04)',
        description:
          'Accepting adds a new LKP point and keeps the old ones as history. Returns 409 SIGHTING_NOT_LKP_CANDIDATE ' +
          'when the sighting was already decided or is not later than the current LKP.',
        params: SightingParams,
        body: LkpDecisionBody,
        response: { 200: LkpDecisionResult, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => {
      const { missionId, sightingId } = request.params;
      const result = await decideLkp(db, {
        missionId,
        sightingId,
        decision: request.body.decision,
        userId: actorOf(request).userId,
      });
      realtime.publish({ type: 'sighting.saved', missionId, sighting: result.sighting });
      if (request.body.decision === 'accepted') realtime.publish({ type: 'lkp.changed', missionId, lkp: result.lkp });
      return result;
    },
  );

  app.get(
    '/missions/:missionId/lkps',
    {
      schema: {
        tags: ['sightings'],
        summary: 'List every LKP the mission had, newest first. The first is the current one (decision 58)',
        params: MissionParams,
        response: { 200: LkpPointList, 400: ApiError, 401: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    (request) => listLkps(db, request.params.missionId),
  );
};
