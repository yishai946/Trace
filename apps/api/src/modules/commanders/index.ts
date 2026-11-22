import { ApiError, OwnPhone, SetOwnPhoneBody } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { commandersOnly } from '../../auth/auth.access';
import { actorOf } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { setOwnPhone } from './commanders.service';

export const commanderRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.put(
    '/me/phone',
    {
      schema: {
        tags: ['commanders'],
        summary: "Set or remove the commander's phone number",
        description:
          'Typed as a person writes it (`052-340-1187`) and saved as E.164. Field shows "call the commander" only when it is set. `null` removes it.',
        body: SetOwnPhoneBody,
        response: { 200: OwnPhone, 400: ApiError, 401: ApiError, 403: ApiError, 409: ApiError },
      },
      preHandler: commandersOnly,
    },
    (request) => setOwnPhone(db, { userId: actorOf(request).userId, phoneNumber: request.body.phoneNumber }),
  );
};
