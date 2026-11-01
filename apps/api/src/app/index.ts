import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createAuth, type OtpSender } from '../auth';
import { authRoutes, requireSignIn } from '../auth/auth.plugin';
import type { Db } from '../db';
import type { Env } from '../env';
import { registerErrorHandlers } from '../errors';
import { healthRoutes } from '../modules/health/routes';
import { missionRoutes } from '../modules/missions';
import { participantRoutes } from '../modules/participants';
import { polygonRoutes } from '../modules/polygons';

const VERSION = '0.1.0';

interface AppOptions {
  env: Env;
  db: Db;
  /** Sends searchers their sign-in code. Defaults to writing it to the log outside production. */
  sendOtp?: OtpSender;
}

/** Builds the app without listening, so tests can call it with `app.inject`. */
export async function buildApp({ env, db, sendOtp }: AppOptions) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();
  const auth = createAuth({
    env,
    db,
    sendOtp:
      sendOtp ??
      (async ({ phoneNumber, code }) => {
        // The SMS provider is still an open decision (TECH_STACK.md), so production cannot send codes yet.
        if (env.NODE_ENV === 'production') throw new Error('No SMS provider is configured to send sign-in codes');
        app.log.info({ phoneNumber, code }, 'Sign-in code (development only, not sent by SMS)');
      }),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(swagger, {
    openapi: { info: { title: 'TRACE API', version: VERSION } },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Each domain module (missions, polygons, searchers, ...) registers under /api, behind sign-in.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { version: VERSION });
      await api.register(authRoutes, { auth });
      await api.register(async (signedIn) => {
        requireSignIn(signedIn, { auth, db });
        await signedIn.register(missionRoutes, { db });
        await signedIn.register(polygonRoutes, { db });
        await signedIn.register(participantRoutes, { db });
      });
    },
    { prefix: '/api' },
  );

  return { app, auth };
}
