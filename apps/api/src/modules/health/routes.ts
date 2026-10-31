import { HealthResponse } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginAsyncZod<{ version: string }> = async (app, { version }) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness check',
        response: { 200: HealthResponse },
      },
    },
    async () => ({ status: 'ok' as const, version, time: new Date().toISOString() }),
  );
};
