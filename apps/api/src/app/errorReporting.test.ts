import * as Sentry from '@sentry/node';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db';
import { loadEnv } from '../env';
import { AppError, missionEnded, notFound } from '../errors';
import { initMonitoring } from '../monitoring';
import { createFakeSentryTransport } from '../testing/sentryTransport';
import { TEST_DATABASE_URL } from '../testing/testing.config';
import { buildApp } from '.';

const lines: Array<Record<string, unknown>> = [];
const logStream = new Writable({
  write(chunk, _encoding, done) {
    for (const line of String(chunk).split('\n').filter(Boolean)) lines.push(JSON.parse(line));
    done();
  },
});

describe('error reporting and request ids', () => {
  const database = createDb(TEST_DATABASE_URL);
  const transport = createFakeSentryTransport();
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      LOG_LEVEL: 'error',
      DATABASE_URL: TEST_DATABASE_URL,
      SENTRY_DSN: 'https://publickey@o1.ingest.sentry.io/2',
    });
    initMonitoring(env, transport.factory);
    ({ app } = await buildApp({ env, db: database.db, logStream }));
    app.get('/api/boom', async () => {
      throw new Error('database exploded for +972501234567');
    });
    app.get('/api/gone', async () => {
      throw notFound('Mission');
    });
    app.get('/api/ended', async () => {
      throw missionEnded('The mission has ended');
    });
    app.get('/api/bad', async () => {
      throw new AppError(400, 'VALIDATION_ERROR', 'Bad input');
    });
    app.get('/api/framework-bad', async () => {
      throw Object.assign(new Error('bad body'), { statusCode: 400 });
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await Sentry.close();
  });

  it('reports a throwing route once, answers 500 and tags the event with the request id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/boom' });
    await Sentry.flush(2000);
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(transport.events).toHaveLength(1);
    const [event] = transport.events;
    const requestId = response.headers['x-request-id'];
    expect(event?.tags).toMatchObject({ request_id: requestId });
    expect(JSON.stringify(event)).not.toContain('+972501234567');
    expect(lines.find((line) => line.reqId === requestId)).toBeDefined();
  });

  it('does not report 404, 409 or 400 answers', async () => {
    const before = transport.events.length;
    const statuses = [];
    for (const url of ['/api/gone', '/api/ended', '/api/bad', '/api/framework-bad', '/api/no-such-route']) {
      statuses.push((await app.inject({ method: 'GET', url })).statusCode);
    }
    await Sentry.flush(2000);
    expect(statuses).toEqual([404, 409, 400, 400, 404]);
    expect(transport.events).toHaveLength(before);
  });

  it('returns a different x-request-id for each request', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/health' });
    const second = await app.inject({ method: 'GET', url: '/api/health' });
    expect(first.headers['x-request-id']).toEqual(expect.any(String));
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });
});
