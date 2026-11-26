import { ApiError, MissionParams, OwnParticipation } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { searcherOf } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { finishSearch, pauseOrResumeSearch, startSearch } from './participants.search';

/** The searcher's own search task: Start Search, Pause, Resume and Finish (UC-F06 to UC-F08). */
export const searchRoutes: FastifyPluginAsyncZod<ServiceDeps> = async (app, deps) => {
  const { db } = deps;
  app.post(
    '/missions/:missionId/participation/search/start',
    {
      schema: {
        tags: ['participants'],
        summary: 'Start the search: the assigned task goes from Ready to Searching (UC-F06)',
        description:
          'Searchers in the mission only. The commander sees the change at once. Sending it again while searching ' +
          'changes nothing. 409 NOT_ASSIGNED without a polygon, TASK_NOT_READY when the task is paused or ' +
          'finished, MISSION_NOT_ACTIVE while the mission is paused, MISSION_ENDED, PARTICIPATION_ENDED. The ' +
          'phone checks the offline package and the permissions itself (decisions 73, 85).',
        params: MissionParams,
        response: { 200: OwnParticipation, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) => startSearch(deps, { missionId: request.params.missionId, searcherId: searcherOf(request).searcherId }),
  );

  for (const action of ['pause', 'resume'] as const) {
    app.post(
      `/missions/:missionId/participation/search/${action}`,
      {
        schema: {
          tags: ['participants'],
          summary:
            action === 'pause'
              ? 'Pause the search: Searching becomes Paused (UC-F07)'
              : 'Resume the search: Paused becomes Searching (UC-F07)',
          description:
            'Searchers in the mission only. Safety tracking goes on; points taken while paused do not count toward ' +
            'Coverage (decision 71). The commander sees the change at once. Sending it again changes nothing. ' +
            `409 ${action === 'pause' ? 'TASK_NOT_SEARCHING' : 'TASK_NOT_PAUSED'} for a task in another status, ` +
            'MISSION_NOT_ACTIVE while the mission is paused (a mission Pause outranks a personal one), NOT_ASSIGNED, ' +
            'MISSION_ENDED, PARTICIPATION_ENDED.',
          params: MissionParams,
          response: {
            200: OwnParticipation,
            400: ApiError,
            401: ApiError,
            403: ApiError,
            404: ApiError,
            409: ApiError,
          },
        },
        preHandler: [searchersOnly, missionAccess(db, 'member')],
      },
      (request) =>
        pauseOrResumeSearch(deps, {
          missionId: request.params.missionId,
          searcherId: searcherOf(request).searcherId,
          action,
        }),
    );
  }

  app.post(
    '/missions/:missionId/participation/search/finish',
    {
      schema: {
        tags: ['participants'],
        summary: 'Finish the search: Searching or Paused becomes Finished (UC-F08)',
        description:
          'Searchers in the mission only. The searcher stays assigned to the polygon (decision 100); this is not ' +
          'Activity Ended (decision 9) and the polygon does not become Completed (decision 10). The route and ' +
          'Coverage collected stay. The commander sees the change at once. Sending it again changes nothing. ' +
          '409 TASK_NOT_ACTIVE for a task still at Ready, MISSION_NOT_ACTIVE while the mission is paused, ' +
          'NOT_ASSIGNED, MISSION_ENDED, PARTICIPATION_ENDED.',
        params: MissionParams,
        response: { 200: OwnParticipation, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    (request) =>
      finishSearch(deps, { missionId: request.params.missionId, searcherId: searcherOf(request).searcherId }),
  );
};
