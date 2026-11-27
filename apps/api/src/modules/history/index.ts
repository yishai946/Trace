import { ApiError, MissionParams, OwnActivity } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { searcherOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { getOwnActivity } from './history.service';

export const historyRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/missions/:missionId/my-activity',
    {
      schema: {
        tags: ['history'],
        summary: "The searcher's own activity in an ended mission, read-only (UC-F17)",
        description:
          'Searchers who took part only; 404 while the mission has not ended. Holds their own participation, ' +
          "reports and sightings, never other searchers' (decision 95).",
        params: MissionParams,
        response: { 200: OwnActivity, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) => {
      const { searcherId, userId } = searcherOf(request);
      return getOwnActivity(db, { missionId: request.params.missionId, searcherId, userId });
    },
  );
};
