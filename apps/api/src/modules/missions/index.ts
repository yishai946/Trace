import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import { ApiError, CreateMissionBody, Mission, MissionList, MissionParams } from '@trace/schemas';
import type { FastifyError } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { commandersOnly, missionAccess } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { AppError } from '../../errors';
import { createMission, getMission, getMissionPhoto, listMissions, setMissionPhoto } from './missions.service';

/** Fastify's own errors for a photo upload, in the API's error codes. Anything else goes to the app's handler. */
function photoUploadError(error: FastifyError): Error {
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return new AppError(413, 'PHOTO_TOO_LARGE', `The photo must be at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB`, {
      maxBytes: MAX_PHOTO_BYTES,
    });
  }
  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return new AppError(415, 'UNSUPPORTED_PHOTO', 'The photo must be a JPEG, PNG or WebP image');
  }
  return error;
}

export const missionRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  // Photos arrive as the raw image bytes, so a phone or browser can send the file as is.
  app.addContentTypeParser(
    [...PHOTO_TYPES],
    { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES },
    (_request, body, done) => done(null, body),
  );

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
    // Nothing is published: nobody can have joined a mission that did not exist, so no one is listening for its events.
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

  app.put(
    '/missions/:missionId/photo',
    {
      schema: {
        tags: ['missions'],
        summary: "Set or replace the missing person's photo (UC-C02)",
        description: `The body is the image itself: JPEG, PNG or WebP, at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB.`,
        params: MissionParams,
        consumes: [...PHOTO_TYPES],
        response: {
          200: Mission,
          400: ApiError,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
          413: ApiError,
          415: ApiError,
        },
      },
      // onRequest, not preHandler: refuse outsiders before the server reads up to 5 MB of body.
      onRequest: missionAccess(db, 'commander'),
      errorHandler: (error) => {
        throw photoUploadError(error);
      },
    },
    (request) => {
      const body: unknown = request.body;
      if (!Buffer.isBuffer(body)) throw new AppError(415, 'UNSUPPORTED_PHOTO', 'Send the photo as an image');
      return setMissionPhoto(db, request.params.missionId, body);
    },
  );

  app.get(
    '/missions/:missionId/photo',
    {
      schema: {
        tags: ['missions'],
        summary: "Get the missing person's photo",
        description: 'Commanders and searchers in the mission see the photo (UC-F04). 404 when there is none.',
        params: MissionParams,
        querystring: z.object({ v: z.string().optional().describe("The photo's version, from photoUrl") }),
        produces: [...PHOTO_TYPES],
      },
      preHandler: missionAccess(db, 'member'),
    },
    async (request, reply) => {
      const photo = await getMissionPhoto(db, request.params.missionId);
      // A URL with the current version (`?v=`, from photoUrl) never changes, so the browser may keep it.
      // Any other URL may point at a newer photo next time. Only the signed-in user's browser may cache either.
      const current = request.query.v === String(photo.updatedAt.getTime());
      return reply
        .header('content-type', photo.contentType)
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', current ? 'private, max-age=31536000, immutable' : 'private, no-cache')
        .send(photo.data);
    },
  );
};
