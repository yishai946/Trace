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

describe('photo bucket environment', () => {
  const bucket = {
    BUCKET_ENDPOINT: 'https://t3.storageapi.dev',
    BUCKET_NAME: 'trace-photos',
    BUCKET_ACCESS_KEY_ID: 'key',
    BUCKET_SECRET_ACCESS_KEY: 'secret',
  };

  it('works without a bucket outside production and reads one when all four values are set', () => {
    expect(loadEnv({}).BUCKET_ENDPOINT).toBeUndefined();
    expect(loadEnv(bucket)).toMatchObject({ ...bucket, BUCKET_REGION: 'auto' });
  });

  it('refuses a bucket that is only partly set', () => {
    expect(() => loadEnv({ BUCKET_ENDPOINT: bucket.BUCKET_ENDPOINT })).toThrow(/BUCKET_NAME/);
  });

  it('requires the bucket in production, so photos are never kept only in memory', () => {
    const production = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db/trace',
      API_URL: 'https://api.example.net',
    };
    const withSecret = { ...production, AUTH_SECRET: 'x'.repeat(32) };
    expect(() => loadEnv(withSecret)).toThrow(/BUCKET_ENDPOINT is required in production/);
    expect(loadEnv({ ...withSecret, ...bucket }).BUCKET_NAME).toBe('trace-photos');
  });
});

describe('proxy environment', () => {
  it('does not trust a proxy unless TRUST_PROXY is true', () => {
    expect(loadEnv({}).TRUST_PROXY).toBe(false);
    expect(loadEnv({ TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(() => loadEnv({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });
});

describe('out-of-polygon tolerance environment', () => {
  it('has no default: unset or blank stays unset', () => {
    expect(loadEnv({}).OUT_OF_POLYGON_TOLERANCE_METERS).toBeUndefined();
    expect(loadEnv({ OUT_OF_POLYGON_TOLERANCE_METERS: '' }).OUT_OF_POLYGON_TOLERANCE_METERS).toBeUndefined();
  });

  it('reads a number of meters and refuses a negative one', () => {
    expect(loadEnv({ OUT_OF_POLYGON_TOLERANCE_METERS: '12.5' }).OUT_OF_POLYGON_TOLERANCE_METERS).toBe(12.5);
    expect(() => loadEnv({ OUT_OF_POLYGON_TOLERANCE_METERS: '-1' })).toThrow(/OUT_OF_POLYGON_TOLERANCE_METERS/);
  });
});
