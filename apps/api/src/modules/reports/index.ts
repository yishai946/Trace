import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@trace/domain';
import {
  ApiError,
  CreateReportBody,
  MissionParams,
  Report,
  ReportList,
  ReportParams,
  UpdateReportBody,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { AppError, forbidden } from '../../errors';
import type { Realtime } from '../../realtime';
import { acceptPhotoBodies, photoUploadError } from '../photoUpload';
import {
  createReport,
  deleteReport,
  getReportPhoto,
  listReports,
  markReportHandled,
  reportRecipients,
  setReportPhoto,
  updateReport,
} from './reports.service';

export const reportRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (app, { db, realtime }) => {
  acceptPhotoBodies(app);

  /** Who gets a report's events besides the commander (decision 80), read after the change is saved. */
  const recipientsOf = async (reportId: string) => ({ searcherIds: await reportRecipients(db, { reportId }) });

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
      if (created) {
        realtime.publish({ type: 'report.saved', missionId, report }, await recipientsOf(report.id));
      }
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
      const report = await setReportPhoto(db, { missionId, reportId, userId: actorOf(request).userId, data: body });
      realtime.publish({ type: 'report.saved', missionId, report }, await recipientsOf(report.id));
      return report;
    },
  );

  app.get(
    '/missions/:missionId/reports',
    {
      schema: {
        tags: ['reports'],
        summary: 'List the reports the caller may see, newest first (UC-C11, UC-F11)',
        description:
          "The mission's commander gets all of them. A searcher gets the reports from the polygon they are assigned " +
          'to and their own (decision 80); an Available searcher or one who finished gets only their own.',
        params: MissionParams,
        response: { 200: ReportList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    (request) => listReports(db, { missionId: request.params.missionId, actor: actorOf(request) }),
  );

  app.get(
    '/missions/:missionId/reports/:reportId/photo',
    {
      schema: {
        tags: ['reports'],
        summary: "Get a report's photo (UC-C11)",
        description:
          "The mission's commander, the author, or a searcher who may see the report (decision 80); 404 for anyone " +
          'else and when there is no photo.',
        params: ReportParams,
        querystring: z.object({ v: z.string().optional().describe("The photo's version, from photoUrl") }),
        produces: [...PHOTO_TYPES],
      },
      preHandler: missionAccess(db, 'member'),
    },
    async (request, reply) => {
      const { missionId, reportId } = request.params;
      const photo = await getReportPhoto(db, { missionId, reportId, actor: actorOf(request) });
      // A URL with the current version (`?v=`, from photoUrl) never changes, so the browser may keep it.
      const current = request.query.v === String(photo.updatedAt.getTime());
      return reply
        .header('content-type', photo.contentType)
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', current ? 'private, max-age=31536000, immutable' : 'private, no-cache')
        .send(photo.data);
    },
  );

  app.post(
    '/missions/:missionId/reports/:reportId/handle',
    {
      schema: {
        tags: ['reports'],
        summary: 'Mark a report Handled (UC-C11, decision 17)',
        description:
          "The mission's commander. One way: marking a handled report again answers 200 with it unchanged. " +
          '409 MISSION_ENDED for an ended mission.',
        params: ReportParams,
        response: { 200: Report, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => {
      const { missionId, reportId } = request.params;
      const { report, changed } = await markReportHandled(db, { missionId, reportId });
      if (changed) realtime.publish({ type: 'report.saved', missionId, report }, await recipientsOf(report.id));
      return report;
    },
  );

  app.patch(
    '/missions/:missionId/reports/:reportId',
    {
      schema: {
        tags: ['reports'],
        summary: "Edit a report's type or text (UC-C11, decision 88)",
        description:
          "The mission's commander or the searcher who sent it; no version history. 403 for another searcher, " +
          '409 MISSION_ENDED for an ended mission.',
        params: ReportParams,
        body: UpdateReportBody,
        response: { 200: Report, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    async (request) => {
      const { missionId, reportId } = request.params;
      const report = await updateReport(db, { missionId, reportId, actor: actorOf(request), body: request.body });
      realtime.publish({ type: 'report.saved', missionId, report }, await recipientsOf(report.id));
      return report;
    },
  );

  app.delete(
    '/missions/:missionId/reports/:reportId',
    {
      schema: {
        tags: ['reports'],
        summary: 'Delete a report (UC-C11, decision 89)',
        description: "Only the mission's commander; the author gets 403 too. 409 MISSION_ENDED for an ended mission.",
        params: ReportParams,
        response: { 204: z.null(), 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request, reply) => {
      const { missionId, reportId } = request.params;
      const { searcherIds } = await deleteReport(db, { missionId, reportId });
      realtime.publish({ type: 'report.deleted', missionId, reportId }, { searcherIds });
      return reply.status(204).send(null);
    },
  );
};
