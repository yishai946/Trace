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
}

/** Builds the app without listening, so tests can call it with `app.inject`. */
export async function buildApp({ env, db }: AppOptions) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();

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

  // Each domain module (missions, polygons, searchers, ...) registers under /api.
  await app.register(
    async (api) => {
      await api.register(healthRoutes, { version: VERSION });
      await api.register(missionRoutes, { db });
      await api.register(polygonRoutes, { db });
      await api.register(participantRoutes, { db });
    },
    { prefix: '/api' },
  );

  return app;
}
