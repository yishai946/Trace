import { ApiError, AuthSession, OwnPhone } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../../db/schema';
import { createTestApp, injectAs, resetDb, signInCommander, signInSearcher, type TestContext } from '../../testing';

describe('commander phone number', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
  });
  afterAll(async () => {
    await ctx.close();
  });

  const savedPhone = async (userId: string) =>
    (await ctx.db.select({ phone: users.phoneNumber }).from(users).where(eq(users.id, userId)))[0]?.phone;

  it('saves a typed number as E.164', async () => {
    const commander = await signInCommander(ctx);
    const res = await injectAs(
      ctx,
      commander,
    )({
      method: 'PUT',
      url: '/api/me/phone',
      payload: { phoneNumber: '052-340-1187' },
    });
    expect(res.statusCode).toBe(200);
    expect(OwnPhone.parse(res.json())).toEqual({ phoneNumber: '+972523401187' });
    expect(await savedPhone(commander.userId)).toBe('+972523401187');
  });

  it('shows the saved number in the session Command reads', async () => {
    const inject = injectAs(ctx, await signInCommander(ctx));
    await inject({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: '0523401187' } });
    const session = AuthSession.parse((await inject({ method: 'GET', url: '/api/auth/get-session' })).json());
    expect(session?.user.phoneNumber).toBe('+972523401187');
  });

  it('changes and removes the number', async () => {
    const commander = await signInCommander(ctx);
    const inject = injectAs(ctx, commander);
    await inject({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: '0523401187' } });
    await inject({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: '+14155550123' } });
    expect(await savedPhone(commander.userId)).toBe('+14155550123');

    const res = await inject({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: null } });
    expect(OwnPhone.parse(res.json())).toEqual({ phoneNumber: null });
    expect(await savedPhone(commander.userId)).toBeNull();
  });

  it('rejects what is not a phone number', async () => {
    const commander = await signInCommander(ctx);
    const inject = injectAs(ctx, commander);
    for (const payload of [{ phoneNumber: 'abc' }, { phoneNumber: '052' }, { phoneNumber: '' }, {}]) {
      const res = await inject({ method: 'PUT', url: '/api/me/phone', payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    }
    expect(await savedPhone(commander.userId)).toBeNull();
  });

  it('refuses a number another user already signs in with', async () => {
    const searcher = await signInSearcher(ctx, { name: 'דנה' });
    const taken = (await savedPhone(searcher.userId)) ?? '';
    const commander = await signInCommander(ctx);
    const res = await injectAs(
      ctx,
      commander,
    )({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: taken } });
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('PHONE_IN_USE');
    expect(await savedPhone(commander.userId)).toBeNull();
  });

  it('is for commanders only', async () => {
    const searcher = await signInSearcher(ctx, { name: 'דנה' });
    const res = await injectAs(
      ctx,
      searcher,
    )({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: '0523401187' } });
    expect(res.statusCode).toBe(403);
  });

  it('needs a signed-in user', async () => {
    const res = await ctx.app.inject({ method: 'PUT', url: '/api/me/phone', payload: { phoneNumber: '0523401187' } });
    expect(res.statusCode).toBe(401);
  });
});
