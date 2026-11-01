import { ApiError, MissionParams, ParticipantList } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db';
import { listParticipants } from './participants.service';

export const participantRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/missions/:missionId/participants',
    {
      schema: {
        tags: ['participants'],
        summary: 'List the searchers in a mission with their assignment and last position',
        params: MissionParams,
        response: { 200: ParticipantList, 400: ApiError, 404: ApiError },
      },
    },
    (request) => listParticipants(db, request.params.missionId),
  );
};
