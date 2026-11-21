import {
  ApiError,
  CreatePolygonBody,
  MissionParams,
  MissionPolygon,
  MissionPolygonList,
  PolygonParams,
  UpdatePolygonBody,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { missionAccess } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { createPolygon, deletePolygon, listPolygons, updatePolygon } from './polygons.service';

export const polygonRoutes: FastifyPluginAsyncZod<ServiceDeps> = async (app, deps) => {
  const { db } = deps;
  app.get(
    '/missions/:missionId/polygons',
    {
      schema: {
        tags: ['polygons'],
        summary: 'List the polygons on the active map',
        params: MissionParams,
        response: { 200: MissionPolygonList, 400: ApiError, 401: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    (request) => listPolygons(db, request.params.missionId),
  );

  app.post(
    '/missions/:missionId/polygons',
    {
      schema: {
        tags: ['polygons'],
        summary: 'Draw a polygon (UC-C06)',
        params: MissionParams,
        body: CreatePolygonBody,
        response: { 201: MissionPolygon, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request, reply) => {
      const { missionId } = request.params;
      return reply.status(201).send(await createPolygon(deps, missionId, request.body, actorOf(request)));
    },
  );

  app.patch(
    '/missions/:missionId/polygons/:polygonId',
    {
      schema: {
        tags: ['polygons'],
        summary: 'Rename a polygon or change its boundary (UC-C06)',
        description:
          'Returns 409 SEARCHERS_OUTSIDE_POLYGON with the affected searchers when the new boundary leaves assigned ' +
          'searchers outside. Send again with confirmSearchersOutside: true after the commander confirms.',
        params: PolygonParams,
        body: UpdatePolygonBody,
        response: { 200: MissionPolygon, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => {
      const { missionId, polygonId } = request.params;
      return updatePolygon(deps, { missionId, polygonId, input: request.body, actor: actorOf(request) });
    },
  );

  app.delete(
    '/missions/:missionId/polygons/:polygonId',
    {
      schema: {
        tags: ['polygons'],
        summary: 'Delete a polygon from the active map (UC-C06). Its history stays.',
        params: PolygonParams,
        response: { 204: z.null(), 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request, reply) => {
      const { missionId, polygonId } = request.params;
      await deletePolygon(deps, missionId, polygonId, actorOf(request));
      return reply.status(204).send(null);
    },
  );
};
