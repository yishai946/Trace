import { ApiError, CreateSosBody, MissionParams, Sos, SosList, SosParams } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { missionAccess, searchersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import { forbidden } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { listSos } from './sos.read';
import { activateSos, closeSos } from './sos.service';

export const sosRoutes: FastifyPluginAsyncZod<ServiceDeps> = async (app, deps) => {
  const { db } = deps;
  app.post(
    '/missions/:missionId/sos',
    {
      schema: {
        tags: ['sos'],
        summary: 'Activate an SOS (UC-F13)',
        description:
          'A searcher in the mission whose activity has not ended, in any mission state. It goes to the commander and ' +
          'to the searchers assigned to the sender’s polygon (decision 98). Without a location the last known position ' +
          'is used, and those searchers also get a push, so it reaches them with the app in the background. An SOS ' +
          'that is already active is returned with 200 and nothing is sent again. Returns 400 ' +
          'VALIDATION_ERROR, 403 FORBIDDEN (the commander, or no profile), 404 NOT_FOUND, 409 PARTICIPATION_ENDED.',
        params: MissionParams,
        body: CreateSosBody,
        response: { 200: Sos, 201: Sos, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError },
      },
      preHandler: [searchersOnly, missionAccess(db, 'member')],
    },
    async (request, reply) => {
      const actor = actorOf(request);
      // `searchersOnly` already refused anyone else; this narrows the type.
      if (actor.role !== 'searcher' || !actor.searcherId) throw forbidden();
      const { missionId } = request.params;
      const { sos, created } = await activateSos(deps, {
        ...request.body,
        missionId,
        actor: { userId: actor.userId, searcherId: actor.searcherId },
      });
      return reply.status(created ? 201 : 200).send(sos);
    },
  );

  app.post(
    '/missions/:missionId/sos/:sosId/close',
    {
      schema: {
        tags: ['sos'],
        summary: 'Close an SOS (UC-F13, UC-C14)',
        description:
          'The commander closes any SOS of the mission, a searcher only their own (decision 99). The update goes to ' +
          'the same people as the activation, by push as well (to the sender too when someone else closes it). ' +
          'Closing a closed SOS returns it unchanged. Returns 403 FORBIDDEN for ' +
          'another searcher, 404 NOT_FOUND for an unknown SOS.',
        params: SosParams,
        response: { 200: Sos, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    async (request) => {
      const { missionId, sosId } = request.params;
      const actor = actorOf(request);
      return closeSos(deps, { missionId, sosId, actor });
    },
  );

  app.get(
    '/missions/:missionId/sos',
    {
      schema: {
        tags: ['sos'],
        summary: 'List the mission’s SOS, newest first (UC-F13, UC-C14)',
        description:
          'The commander sees all of them; a searcher sees those they sent and those sent to them. Clients read it ' +
          'again after a lost connection.',
        params: MissionParams,
        response: { 200: SosList, 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError },
      },
      preHandler: missionAccess(db, 'member'),
    },
    (request) => listSos(db, { missionId: request.params.missionId, actor: actorOf(request) }),
  );
};
