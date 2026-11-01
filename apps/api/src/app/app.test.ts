import { ApiError, HealthResponse } from '@trace/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../env';
import { createTestApp } from '../testing';

describe('api', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  it('GET /api/health matches the shared schema', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.safeParse(res.json()).success).toBe(true);
  });

  it('serves an OpenAPI document generated from the zod schemas', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.paths['/api/health']).toBeDefined();
    expect(doc.paths['/api/missions/{missionId}/polygons/{polygonId}']).toBeDefined();
    expect(doc.components.schemas.HealthResponse).toBeDefined();
    expect(doc.components.schemas.MissionPolygon).toBeDefined();
  });

  it('answers unknown routes with the shared error shape', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/nothing-here' });
    expect(res.statusCode).toBe(404);
    expect(ApiError.parse(res.json()).error.code).toBe('NOT_FOUND');
  });

  it('answers malformed JSON with a validation error', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid environment variables at startup', () => {
    expect(() => loadEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment variables/);
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is required/);
  });
});
