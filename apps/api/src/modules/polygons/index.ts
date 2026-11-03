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
import type { Db } from '../../db';
import type { Realtime } from '../../realtime';
import { createPolygon, deletePolygon, listPolygons, updatePolygon } from './polygons.service';

export const polygonRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (app, { db, realtime }) => {
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
      const polygon = await createPolygon(db, missionId, request.body);
      realtime.publish({ type: 'polygon.saved', missionId, polygon });
      return reply.status(201).send(polygon);
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
      const polygon = await updatePolygon(db, missionId, polygonId, request.body);
      realtime.publish({ type: 'polygon.saved', missionId, polygon });
      return polygon;
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
      await deletePolygon(db, missionId, polygonId);
      realtime.publish({ type: 'polygon.deleted', missionId, polygonId });
      return reply.status(204).send(null);
    },
  );
};
