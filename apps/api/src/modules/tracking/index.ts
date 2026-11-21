import {
  ApiError,
  MissionParams,
  ParticipantParams,
  ParticipantTrack,
  TrackPointsBody,
  TrackPointsResult,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { searcherOf } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { getTrack, recordTrackPoints } from './tracking.service';

export const trackingRoutes: FastifyPluginAsyncZod<ServiceDeps> = async (app, deps) => {
  const { db } = deps;
  app.post(
    '/missions/:missionId/track-points',
    {
      // Every searcher's phone calls this every few seconds; one line each would drown the log.
      config: { requestLogLevel: 'debug' },
      schema: {
        tags: ['tracking'],
        summary: "Upload a batch of the searcher's own GPS points (UC-S01)",
        description:
          'Searchers in the mission only. Each point keeps when it was recorded and what for (`search` while ' +
          'Searching, `safety` otherwise). A point already saved is skipped, so a repeated upload adds nothing. The ' +
          'newest point becomes the last position, sent at once to the commander. 409 PARTICIPATION_ENDED after ' +
          'Finish Activity.',
        params: MissionParams,
        body: TrackPointsBody,
        response: { 200: TrackPointsResult, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request) => {
      const { searcherId } = searcherOf(request);
      const { missionId } = request.params;
      return recordTrackPoints(deps, { missionId, searcherId, body: request.body });
    },
  );

  app.get(
    '/missions/:missionId/participants/:participantId/track',
    {
      // Every searcher's phone calls this every few seconds; one line each would drown the log.
      config: { requestLogLevel: 'debug' },
      schema: {
        tags: ['tracking'],
        summary: "A searcher's route, oldest point first (UC-C10)",
        description:
          "The mission's commander only; a searcher, even for their own route, gets 403 (decision 32). The route " +
          'stays readable after the searcher finished and after the mission ended.',
        params: ParticipantParams,
        response: { 200: ParticipantTrack, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => getTrack(db, request.params),
  );
};
