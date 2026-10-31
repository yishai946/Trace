import { HealthResponse } from '@trace/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadEnv } from './env';

describe('api', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp(loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
  });

  afterAll(() => app.close());

  it('GET /api/health matches the shared schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.safeParse(res.json()).success).toBe(true);
  });

  it('serves an OpenAPI document generated from the zod schemas', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.paths['/api/health']).toBeDefined();
    expect(doc.components.schemas.HealthResponse).toBeDefined();
  });

  it('rejects invalid environment variables at startup', () => {
    expect(() => loadEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment variables/);
  });
});
