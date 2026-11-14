import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createDb } from '../db';
import { loadEnv } from '../env';
import { resetDb } from '../testing';
import { TEST_DATABASE_URL } from '../testing/testing.config';
import { defaultLogLevel } from '.';

/** Collects every JSON line the logger writes. */
function captureLogs() {
  const lines: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      for (const line of String(chunk).split('\n').filter(Boolean)) lines.push(JSON.parse(line));
      done();
    },
  });
  return { lines, stream };
}

describe('defaultLogLevel', () => {
  it('logs info in production, debug locally and nothing in tests', () => {
    expect(defaultLogLevel('production')).toBe('info');
    expect(defaultLogLevel('development')).toBe('debug');
    expect(defaultLogLevel('test')).toBe('silent');
  });

  it('is what LOG_LEVEL falls back to, and an explicit LOG_LEVEL wins', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).LOG_LEVEL).toBe('debug');
    expect(loadEnv({ NODE_ENV: 'test' }).LOG_LEVEL).toBe('silent');
    expect(loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn');
  });
});

describe('api logging', () => {
  const database = createDb(TEST_DATABASE_URL);
  const logs = captureLogs();
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    await resetDb(database.db);
    ({ app } = await buildApp({
      env: loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info', DATABASE_URL: TEST_DATABASE_URL }),
      db: database.db,
      logStream: logs.stream,
    }));
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  const linesFor = (url: string) => logs.lines.filter((line) => JSON.stringify(line).includes(url));

  it('writes one line per request with its method, route and status', async () => {
    await app.inject({ method: 'GET', url: '/api/missions' });
    const lines = linesFor('/api/missions');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 30, msg: 'request completed', statusCode: 401 });
    expect(lines[0]?.req).toMatchObject({ method: 'GET', url: '/api/missions' });
    expect(lines[0]?.responseTime).toEqual(expect.any(Number));
  });

  it('keeps health checks and GPS uploads out of the info log', async () => {
    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'POST', url: '/api/missions/00000000-0000-0000-0000-000000000000/track-points' });
    await app.inject({
      method: 'GET',
      url: '/api/missions/00000000-0000-0000-0000-000000000000/participants/00000000-0000-0000-0000-000000000000/track',
    });
    expect(linesFor('/health')).toEqual([]);
    expect(linesFor('/track')).toEqual([]);
  });

  it('censors secrets, phone numbers and coordinates', () => {
    app.log.info(
      {
        token: 'session-token',
        password: 'hunter2',
        phoneNumber: '+972501234567',
        searcher: { phone: '+972501234567', lat: 31.77, lng: 35.21 },
        req: { headers: { authorization: 'Bearer abc', cookie: 'session=abc' } },
      },
      'redaction check',
    );
    const line = JSON.stringify(logs.lines.find((l) => l.msg === 'redaction check'));
    for (const secret of ['session-token', 'hunter2', '+972501234567', '31.77', '35.21', 'Bearer abc', 'session=abc']) {
      expect(line).not.toContain(secret);
    }
  });

  it('logs the development sign-in code without the full phone number', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/phone-number/send-otp',
      payload: { phoneNumber: '+972501234567' },
    });
    const line = logs.lines.find((l) => l.msg === 'Sign-in code (development only, not sent by SMS)');
    expect(line).toMatchObject({ phoneEnding: '4567', code: expect.any(String) });
    expect(JSON.stringify(line)).not.toContain('+972501234567');
  });
});
