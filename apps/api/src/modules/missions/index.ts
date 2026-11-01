import { ApiError, CreateMissionBody, Mission, MissionList, MissionParams } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { commandersOnly, missionAccess } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { createMission, getMission, listMissions } from './missions.service';

export const missionRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/missions',
    {
      schema: {
        tags: ['missions'],
        summary: "List the user's missions, newest first",
        description: 'A commander gets the missions they created; a searcher gets the missions they take part in.',
        response: { 200: MissionList, 401: ApiError },
      },
    },
    (request) => listMissions(db, actorOf(request)),
  );

  app.post(
    '/missions',
    {
      schema: {
        tags: ['missions'],
        summary: 'Create a mission (UC-C02). It starts active, with a join code.',
        body: CreateMissionBody,
        response: { 201: Mission, 400: ApiError, 401: ApiError, 403: ApiError },
      },
      preHandler: commandersOnly,
    },
    async (request, reply) =>
      reply.status(201).send(await createMission(db, { ...request.body, commanderId: actorOf(request).userId })),
  );

  app.get(
    '/missions/:missionId',
    {
      schema: {
        tags: ['missions'],
        summary: 'Get a mission',
        params: MissionParams,
        response: { 200: Mission, 400: ApiError, 401: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    (request) => getMission(db, request.params.missionId),
  );
};
