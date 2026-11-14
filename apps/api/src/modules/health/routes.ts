import { HealthResponse } from '@trace/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginAsyncZod<{ version: string }> = async (app, { version }) => {
  app.get(
    '/health',
    {
      // Polled by uptime checks and load balancers; one line each would drown the log.
      config: { requestLogLevel: 'debug' },
      schema: {
        tags: ['system'],
        summary: 'Liveness check',
        response: { 200: HealthResponse },
      },
    },
    async () => ({ status: 'ok' as const, version, time: new Date().toISOString() }),
  );
};
