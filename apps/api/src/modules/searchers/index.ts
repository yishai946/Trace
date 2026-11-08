import { ApiError, SaveSearcherProfileBody, SearcherProfile } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { actorOf } from '../../auth/auth.plugin';
import { searcherSessionsOnly } from '../../auth/auth.access';
import type { Db } from '../../db';
import { notFound } from '../../errors';
import { getOwnProfile, saveOwnProfile } from './searchers.service';

export const searcherRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/searchers/me',
    {
      schema: {
        tags: ['searchers'],
        summary: "Get the signed-in searcher's profile",
        description: 'Answers 404 until the searcher has entered a name on first sign-in (UC-F01).',
        response: { 200: SearcherProfile, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: searcherSessionsOnly,
    },
    async (request) => {
      const profile = await getOwnProfile(db, actorOf(request).userId);
      if (!profile) throw notFound('Searcher profile');
      return profile;
    },
  );

  app.put(
    '/searchers/me',
    {
      schema: {
        tags: ['searchers'],
        summary: "Enter or change the signed-in searcher's name",
        description: 'UC-F01: on first sign-in the searcher enters a name; this creates their profile.',
        body: SaveSearcherProfileBody,
        response: { 200: SearcherProfile, 400: ApiError, 401: ApiError, 403: ApiError },
      },
      preHandler: searcherSessionsOnly,
    },
    (request) => saveOwnProfile(db, { userId: actorOf(request).userId, name: request.body.name }),
  );
};
