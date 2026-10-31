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
import type { Env } from './env';
import { healthRoutes } from './modules/health/routes';

const VERSION = '0.1.0';

/** Builds the app without listening, so tests can call it with `app.inject`. */
export async function buildApp(env: Env) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
    },
    { prefix: '/api' },
  );

  return app;
}
