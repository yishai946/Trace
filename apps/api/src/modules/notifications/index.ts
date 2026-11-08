import { ApiError, RegisterPushTokenBody } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { searchersOnly } from '../../auth/auth.access';
import { actorOf, sessionIdOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { registerPushToken, removePushToken } from './notifications.service';

export const notificationRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.put(
    '/push-token',
    {
      schema: {
        tags: ['notifications'],
        summary: "Register this device's Expo push token (Field, after sign-in)",
        description:
          'One token per signed-in session: registering again, or with a new token, replaces it. Signing out deletes it.',
        body: RegisterPushTokenBody,
        response: { 204: z.null(), 400: ApiError, 401: ApiError, 403: ApiError },
      },
      preHandler: searchersOnly,
    },
    async (request, reply) => {
      const actor = actorOf(request);
      if (actor.role !== 'searcher' || actor.searcherId === null) throw new Error('Unreachable: searchersOnly');
      await registerPushToken(db, {
        searcherId: actor.searcherId,
        sessionId: sessionIdOf(request),
        token: request.body.token,
      });
      return reply.status(204).send(null);
    },
  );

  app.delete(
    '/push-token',
    {
      schema: {
        tags: ['notifications'],
        summary: "Remove this device's push token (Field, when notifications are turned off)",
        description: 'Does nothing when the session has no token.',
        response: { 204: z.null(), 401: ApiError, 403: ApiError },
      },
      preHandler: searchersOnly,
    },
    async (request, reply) => {
      await removePushToken(db, sessionIdOf(request));
      return reply.status(204).send(null);
    },
  );
};
