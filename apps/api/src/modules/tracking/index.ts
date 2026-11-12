import {
  ApiError,
  MissionParams,
  ParticipantParams,
  ParticipantTrack,
  TrackPointsBody,
  TrackPointsResult,
} from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { forbidden } from '../../errors';
import type { Realtime } from '../../realtime';
import { listParticipants } from '../participants/participants.service';
import { getTrack, recordTrackPoints } from './tracking.service';

export const trackingRoutes: FastifyPluginAsyncZod<{ db: Db; realtime: Realtime }> = async (app, { db, realtime }) => {
  app.post(
    '/missions/:missionId/track-points',
    {
      schema: {
        tags: ['tracking'],
        summary: "Upload a batch of the searcher's own GPS points (UC-S01)",
        description:
          'Searchers in the mission only. Each point keeps when it was recorded and what for (`search` while ' +
          'Searching, `safety` otherwise). A point already saved is skipped, so a repeated upload adds nothing. The ' +
          'newest point becomes the last position, sent at once to the commander. 409 PARTICIPATION_ENDED after ' +
          'Finish Activity.',
        params: MissionParams,
        body: TrackPointsBody,
        response: { 200: TrackPointsResult, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId } = request.params;
      const result = await recordTrackPoints(db, { missionId, searcherId: actor.searcherId, body: request.body });
      if (result.moved) {
        realtime.publish({
          type: 'participant.moved',
          missionId,
          participantId: result.participantId,
          searcherId: actor.searcherId,
          ...result.moved,
        });
      }
      if (result.storedPoints.length > 0) {
        realtime.publish({
          type: 'participant.tracked',
          missionId,
          participantId: result.participantId,
          points: result.storedPoints,
        });
      }
      if (result.gpsBack) {
        const participant = (await listParticipants(db, missionId)).find((p) => p.id === result.participantId);
        if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
      }
      return { stored: result.stored, duplicates: result.duplicates };
    },
  );

  app.get(
    '/missions/:missionId/participants/:participantId/track',
    {
      schema: {
        tags: ['tracking'],
        summary: "A searcher's route, oldest point first (UC-C10)",
        description:
          "The mission's commander only; a searcher, even for their own route, gets 403 (decision 32). The route " +
          'stays readable after the searcher finished and after the mission ended.',
        params: ParticipantParams,
        response: { 200: ParticipantTrack, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'commander'),
    },
    async (request) => getTrack(db, request.params),
  );
};
