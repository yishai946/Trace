import * as Sentry from '@sentry/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../env';
import { createFakeSentryTransport } from '../testing/sentryTransport';
import { VERSION } from '../version';
import { flushMonitoring, initMonitoring, logAndReport, reportError, sentryOptions } from '.';

const DSN = 'https://publickey@o1.ingest.sentry.io/2';
const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example.net/trace',
  API_URL: 'https://api.example.net',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('sentryOptions', () => {
  it('is null without a DSN', () => {
    expect(sentryOptions(loadEnv(PRODUCTION))).toBeNull();
  });

  it('uses the production defaults, the package release and no personal data', () => {
    const options = sentryOptions(loadEnv({ ...PRODUCTION, SENTRY_DSN: DSN }));
    expect(options).toMatchObject({
      dsn: DSN,
      environment: 'production',
      release: `trace-api@${VERSION}`,
      sampleRate: 1,
      tracesSampleRate: 0.05,
      maxBreadcrumbs: 30,
      sendDefaultPii: false,
    });
  });

  it('takes the environment, release and trace rate from the variables', () => {
    const env = loadEnv({
      SENTRY_DSN: DSN,
      SENTRY_ENVIRONMENT: 'staging',
      SENTRY_RELEASE: 'abc123',
      SENTRY_TRACES_SAMPLE_RATE: '0.5',
    });
    expect(sentryOptions(env)).toMatchObject({ environment: 'staging', release: 'abc123', tracesSampleRate: 0.5 });
  });
});

describe('without a DSN', () => {
  it('does not start Sentry and reporting sends nothing', async () => {
    const transport = createFakeSentryTransport();
    expect(initMonitoring(loadEnv({}), transport.factory)).toBe(false);
    expect(Sentry.isInitialized()).toBe(false);
    reportError(new Error('boom'), { requestId: 'req-1' });
    await flushMonitoring();
    expect(transport.events).toEqual([]);
  });
});

describe('with a DSN', () => {
  const transport = createFakeSentryTransport();

  beforeAll(() => {
    initMonitoring(loadEnv({ ...PRODUCTION, SENTRY_DSN: DSN }), transport.factory);
  });
  afterAll(() => Sentry.close());

  it('sends a scrubbed event tagged with the request id, release and environment', async () => {
    const error = new Error('failed for +972501234567 at 31.7712, 35.2134');
    Sentry.addBreadcrumb({ message: 'GET /x?token=abc', data: { phone: '+972501234567' } });
    reportError(error, { requestId: 'req-9' });
    await flushMonitoring();
    expect(transport.events).toHaveLength(1);
    const [event] = transport.events;
    expect(event).toMatchObject({ release: `trace-api@${VERSION}`, environment: 'production' });
    expect(event?.tags).toMatchObject({ request_id: 'req-9' });
    const text = JSON.stringify(event);
    for (const secret of ['+972501234567', '31.7712', '35.2134', 'token=abc']) expect(text).not.toContain(secret);
  });
  it('logs a failure once at error level and sends one event tagged with its source, without a request id', async () => {
    const before = transport.events.length;
    const logged: Array<{ fields: Record<string, unknown>; message: string }> = [];
    const log = {
      error: (fields: Record<string, unknown>, message: string) => logged.push({ fields, message }),
    };
    const error = new Error('push failed for +972501234567');
    logAndReport(log, error, { source: 'push.send', message: 'Sending failed', fields: { missionId: 'm-1' } });
    await flushMonitoring();
    expect(logged).toEqual([{ fields: { err: error, missionId: 'm-1' }, message: 'Sending failed' }]);
    expect(transport.events).toHaveLength(before + 1);
    const event = transport.events.at(-1);
    expect(event?.tags).toEqual(expect.objectContaining({ source: 'push.send' }));
    expect(event?.tags).not.toHaveProperty('request_id');
    expect(JSON.stringify(event)).not.toContain('+972501234567');
  });
});
