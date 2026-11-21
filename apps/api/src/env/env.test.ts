import { describe, expect, it } from 'vitest';
import { loadEnv } from '.';

describe('monitoring environment', () => {
  it('leaves Sentry and Loki unset by default and takes the environment from NODE_ENV', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    expect(env).toMatchObject({ SENTRY_ENVIRONMENT: 'development' });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.LOKI_URL).toBeUndefined();
  });

  it('treats blank values as unset', () => {
    expect(loadEnv({ SENTRY_DSN: '', LOKI_URL: '', LOKI_USER: '', LOKI_TOKEN: '' }).SENTRY_DSN).toBeUndefined();
  });

  it('reads the Sentry settings and checks the trace rate is between 0 and 1', () => {
    const env = loadEnv({
      SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2',
      SENTRY_ENVIRONMENT: 'staging',
      SENTRY_RELEASE: 'r1',
      SENTRY_TRACES_SAMPLE_RATE: '0.2',
    });
    expect(env).toMatchObject({ SENTRY_ENVIRONMENT: 'staging', SENTRY_RELEASE: 'r1', SENTRY_TRACES_SAMPLE_RATE: 0.2 });
    expect(() => loadEnv({ SENTRY_TRACES_SAMPLE_RATE: '2' })).toThrow(/SENTRY_TRACES_SAMPLE_RATE/);
    expect(() => loadEnv({ SENTRY_DSN: 'not a dsn' })).toThrow(/SENTRY_DSN/);
  });

  it('needs all three Loki values or none', () => {
    const all = { LOKI_URL: 'https://logs.example.net', LOKI_USER: '123', LOKI_TOKEN: 'glc_x' };
    expect(loadEnv(all).LOKI_URL).toBe(all.LOKI_URL);
    expect(() => loadEnv({ LOKI_URL: all.LOKI_URL })).toThrow(/LOKI_USER.*LOKI_TOKEN/s);
    expect(() => loadEnv({ LOKI_URL: all.LOKI_URL, LOKI_USER: '1' })).toThrow(/LOKI_TOKEN/);
  });
});
