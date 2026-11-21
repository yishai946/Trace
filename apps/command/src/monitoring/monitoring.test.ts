import * as Sentry from '@sentry/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api';
import { initMonitoring, reportQueryError, sentryOptions } from '.';

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }));

const DSN = 'https://publickey@o1.ingest.sentry.io/3';

beforeEach(() => vi.clearAllMocks());

describe('sentryOptions', () => {
  it('is null without a DSN', () => {
    expect(sentryOptions({})).toBeNull();
    expect(sentryOptions({ VITE_SENTRY_DSN: '  ' })).toBeNull();
  });

  it('takes the environment and release, no personal data and few traces outside production', () => {
    expect(
      sentryOptions({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_RELEASE: 'trace-command@1', MODE: 'production' }),
    ).toMatchObject({
      dsn: DSN,
      environment: 'production',
      release: 'trace-command@1',
      sendDefaultPii: false,
      tracesSampleRate: 0.05,
    });
    expect(sentryOptions({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'staging' })).toMatchObject({
      environment: 'staging',
      tracesSampleRate: 0,
    });
  });

  it('scrubs events and breadcrumbs before they leave the browser', () => {
    const options = sentryOptions({ VITE_SENTRY_DSN: DSN });
    const event = options?.beforeSend?.({ type: undefined, message: 'call +972501234567' }, {});
    expect(JSON.stringify(event)).not.toContain('+972501234567');
    const crumb = options?.beforeBreadcrumb?.({ message: 'GET /x?token=abc' }, undefined);
    expect(JSON.stringify(crumb)).not.toContain('abc');
  });
});

describe('initMonitoring', () => {
  it('never starts Sentry without a DSN', () => {
    expect(initMonitoring({})).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('starts Sentry with a DSN', () => {
    expect(initMonitoring({ VITE_SENTRY_DSN: DSN })).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN }));
  });
});

describe('reportQueryError', () => {
  it('reports server errors and responses that do not match their schema', () => {
    reportQueryError(new ApiRequestError(500, 'INTERNAL_ERROR', 'Something went wrong'));
    reportQueryError(new SyntaxError('bad shape'));
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it('skips 401, 404 and being offline', () => {
    reportQueryError(new ApiRequestError(401, 'UNAUTHENTICATED', 'Sign in'));
    reportQueryError(new ApiRequestError(404, 'NOT_FOUND', 'Gone'));
    reportQueryError(new ApiRequestError(0, 'NETWORK_ERROR', 'Offline'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
