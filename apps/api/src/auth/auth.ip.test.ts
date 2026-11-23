import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDb, type TestContext } from '../testing';
import { TEST_DATABASE_URL } from '../testing/testing.config';

/** Better Auth limits only in production, so these apps run as production with the settings it requires. */
const production = (extra: Record<string, string>) => ({
  NODE_ENV: 'production',
  API_URL: 'https://api.trace.test',
  AUTH_SECRET: 'x'.repeat(32),
  DATABASE_URL: TEST_DATABASE_URL,
  ...extra,
});

/** Better Auth's per-address allowance for requesting codes (10 per 60 s). */
const IP_LIMIT = 10;

describe('code requests per client address', () => {
  let ctx: TestContext;
  let counter = 0;
  const phone = () => `+97253${String((counter += 1)).padStart(7, '0')}`;
  const request = (ip?: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/auth/phone-number/send-otp',
      payload: { phoneNumber: phone() },
      headers: ip ? { 'x-forwarded-for': ip } : {},
    });
  const exhaust = async (ip: string) => {
    for (let n = 0; n < IP_LIMIT; n += 1) expect((await request(ip)).statusCode).toBe(200);
  };

  afterAll(() => ctx.close());

  describe('behind a trusted proxy', () => {
    beforeEach(async () => {
      if (ctx) await ctx.close();
      ctx = await createTestApp(production({ TRUST_PROXY: 'true' }));
      await resetDb(ctx.db);
    });

    it('gives each client address its own allowance', async () => {
      await exhaust('203.0.113.1');
      expect((await request('203.0.113.1')).statusCode).toBe(429);
      expect((await request('203.0.113.2')).statusCode).toBe(200);
    });
  });

  describe('without a proxy', () => {
    beforeEach(async () => {
      if (ctx) await ctx.close();
      ctx = await createTestApp(production({}));
      await resetDb(ctx.db);
    });

    it('ignores a forged X-Forwarded-For header', async () => {
      await exhaust('203.0.113.1');
      expect((await request('203.0.113.2')).statusCode).toBe(429);
    });
  });
});
