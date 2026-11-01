import { ApiError, CreateMissionBody, Mission, MissionList, MissionParams } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Db } from '../../db';
import { createMission, getMission, listMissions } from './missions.service';

export const missionRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/missions',
    { schema: { tags: ['missions'], summary: 'List missions, newest first', response: { 200: MissionList } } },
    () => listMissions(db),
  );

  app.post(
    '/missions',
    {
      schema: {
        tags: ['missions'],
        summary: 'Create a mission (UC-C02). It starts active, with a join code.',
        body: CreateMissionBody,
        response: { 201: Mission, 400: ApiError },
      },
    },
    async (request, reply) => reply.status(201).send(await createMission(db, request.body)),
  );

  app.get(
    '/missions/:missionId',
    {
      schema: {
        tags: ['missions'],
        summary: 'Get a mission',
        params: MissionParams,
        response: { 200: Mission, 400: ApiError, 404: ApiError },
      },
    },
    (request) => getMission(db, request.params.missionId),
  );
};
