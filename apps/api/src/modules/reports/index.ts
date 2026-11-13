import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import { ApiError, CreateReportBody, MissionParams, Report, ReportParams } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { AppError, forbidden } from '../../errors';
import type { Realtime } from '../../realtime';
import { acceptPhotoBodies, photoUploadError } from '../photoUpload';
import { createReport, setReportPhoto } from './reports.service';

export const reportRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (app, { db, realtime }) => {
  acceptPhotoBodies(app);

  app.post(
    '/missions/:missionId/reports',
    {
      schema: {
        tags: ['reports'],
        summary: 'Send a field report (UC-F09)',
        description:
          'Searchers in the mission only. The id is made on the phone: sending the same id again returns the report ' +
          'already saved (200) instead of a second one. A new report (201) starts as New. 409 MISSION_ENDED for an ' +
          'ended mission, PARTICIPATION_ENDED after Finish Activity, REPORT_ID_TAKEN when the id is another report’s.',
        params: MissionParams,
        body: CreateReportBody,
        response: {
          200: Report,
          201: Report,
          400: ApiError,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
        },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request, reply) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId } = request.params;
      const { report, created, event } = await createReport(db, {
        missionId,
        searcherId: actor.searcherId,
        actor,
        body: request.body,
      });
      if (created && event) realtime.publish({ type: 'timeline.recorded', missionId, event });
      return reply.code(created ? 201 : 200).send(report);
    },
  );

  app.put(
    '/missions/:missionId/reports/:reportId/photo',
    {
      schema: {
        tags: ['reports'],
        summary: "Attach the report's photo (UC-F09)",
        description:
          `The body is the image itself: JPEG, PNG or WebP, at most ${MAX_PHOTO_BYTES / 1024 / 1024} MB.` +
          ' Only the searcher who sent the report. Sending it again replaces it.',
        params: ReportParams,
        consumes: [...PHOTO_TYPES],
        response: {
          200: Report,
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
      onRequest: [searchersOnly, missionAccess(db, 'member')],
      errorHandler: (error) => {
        throw photoUploadError(error);
      },
    },
    async (request) => {
      const body: unknown = request.body;
      if (!Buffer.isBuffer(body)) throw new AppError(415, 'UNSUPPORTED_PHOTO', 'Send the photo as an image');
      const { missionId, reportId } = request.params;
      return setReportPhoto(db, { missionId, reportId, userId: actorOf(request).userId, data: body });
    },
  );
};
