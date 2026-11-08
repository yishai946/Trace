import { ApiError, MissionParams, TimelineEventList } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess } from '../../auth/auth.access';
import type { Db } from '../../db';
import { listTimeline } from './timeline.service';

export const timelineRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/missions/:missionId/timeline',
    {
      schema: {
        tags: ['timeline'],
        summary: "The mission's operational Timeline, oldest first (UC-C19)",
        description: 'Significant events only (decision 54). Commander only. Also for an ended mission, read-only.',
        params: MissionParams,
        response: { 200: TimelineEventList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    (request) => listTimeline(db, request.params.missionId),
  );
};
