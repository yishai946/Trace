import * as Sentry from '@sentry/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../api';
import { initMonitoring, reportQueryError } from '.';
import { sentryOptions } from './options';

vi.mock('@sentry/react-native', () => ({ init: vi.fn(), captureException: vi.fn() }));

const DSN = 'https://publickey@o1.ingest.sentry.io/4';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe('sentryOptions', () => {
  it('is null without a DSN', () => {
    expect(sentryOptions()).toBeNull();
    expect(sentryOptions('  ')).toBeNull();
  });

  it('reports every error, no personal data and few traces outside production', () => {
    expect(sentryOptions(DSN, 'production')).toMatchObject({
      dsn: DSN,
      environment: 'production',
      sampleRate: 1,
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
    });
    expect(sentryOptions(DSN, 'development')).toMatchObject({ tracesSampleRate: 0 });
  });

  it('scrubs events and breadcrumbs before they leave the phone', () => {
    const options = sentryOptions(DSN);
    const event = options?.beforeSend?.({ type: undefined, message: 'call +972501234567' }, {});
    expect(JSON.stringify(event)).not.toContain('+972501234567');
    const crumb = options?.beforeBreadcrumb?.({ message: 'GET /x?token=abc' }, undefined);
    expect(JSON.stringify(crumb)).not.toContain('abc');
  });
});

describe('initMonitoring', () => {
  it('never starts Sentry without a DSN', () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', '');
    expect(initMonitoring()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('starts Sentry with the DSN and environment from the variables', () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', DSN);
    vi.stubEnv('EXPO_PUBLIC_SENTRY_ENVIRONMENT', 'staging');
    expect(initMonitoring()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN, environment: 'staging' }));
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
