import { ApiError, Mission, MissionList, SearcherProfile } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { searchers, users } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInByPhone,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

describe('searchers/me', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx.db));
  afterAll(() => ctx.close());

  it('answers 404 before the name is entered', async () => {
    const user = await signInByPhone(ctx);
    const res = await injectAs(ctx, user)({ method: 'GET', url: '/api/searchers/me' });
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe('NOT_FOUND');
  });

  it('creates the profile with the name entered on first sign-in', async () => {
    const user = await signInByPhone(ctx);
    const inject = injectAs(ctx, user);
    const saved = await inject({ method: 'PUT', url: '/api/searchers/me', payload: { name: '  דנה לוי  ' } });
    expect(saved.statusCode).toBe(200);
    const profile = SearcherProfile.parse(saved.json());
    expect(profile).toMatchObject({ name: 'דנה לוי', phone: user.phoneNumber });

    const read = await inject({ method: 'GET', url: '/api/searchers/me' });
    expect(read.statusCode).toBe(200);
    expect(SearcherProfile.parse(read.json())).toEqual(profile);

    const rows = await ctx.db.select().from(searchers).where(eq(searchers.userId, user.userId));
    expect(rows.map((row) => row.name)).toEqual(['דנה לוי']);
    const [account] = await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, user.userId));
    expect(account?.name).toBe('דנה לוי');
  });

  it('returns the same searcher on a second sign-in with the same phone', async () => {
    const commander = await signInCommander(ctx);
    const created = await injectAs(
      ctx,
      commander,
    )({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    const mission = Mission.parse(created.json());

    const first = await signInSearcher(ctx, { name: 'דנה' });
    const [row] = await ctx.db
      .select({ phone: searchers.phone })
      .from(searchers)
      .where(eq(searchers.id, first.searcherId));
    const phoneNumber = row?.phone ?? '';
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: first.searcherId });

    const again = await signInByPhone(ctx, phoneNumber);
    expect(again.userId).toBe(first.userId);
    const inject = injectAs(ctx, again);
    const profile = SearcherProfile.parse((await inject({ method: 'GET', url: '/api/searchers/me' })).json());
    expect(profile).toMatchObject({ id: first.searcherId, name: 'דנה' });
    expect(await ctx.db.select().from(searchers).where(eq(searchers.phone, phoneNumber))).toHaveLength(1);

    const missions = MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json());
    expect(missions.map((m) => m.id)).toEqual([mission.id]);
  });

  it('changes the name and keeps the profile', async () => {
    const user = await signInByPhone(ctx);
    const inject = injectAs(ctx, user);
    const first = SearcherProfile.parse(
      (await inject({ method: 'PUT', url: '/api/searchers/me', payload: { name: 'דנה לוי' } })).json(),
    );
    const res = await inject({ method: 'PUT', url: '/api/searchers/me', payload: { name: 'דנה כהן' } });
    expect(res.statusCode).toBe(200);
    expect(SearcherProfile.parse(res.json())).toMatchObject({ id: first.id, name: 'דנה כהן' });
    expect(await ctx.db.select().from(searchers)).toHaveLength(1);
  });

  it('rejects an empty or too long name', async () => {
    const inject = injectAs(ctx, await signInByPhone(ctx));
    for (const payload of [{ name: '   ' }, { name: 'א'.repeat(61) }, { name: 'x\u0000y' }, {}]) {
      const res = await inject({ method: 'PUT', url: '/api/searchers/me', payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(errorCode(res)).toBe('VALIDATION_ERROR');
    }
    expect(await ctx.db.select().from(searchers)).toHaveLength(0);
  });

  it('is for searchers only', async () => {
    const inject = injectAs(ctx, await signInCommander(ctx));
    for (const res of [
      await inject({ method: 'GET', url: '/api/searchers/me' }),
      await inject({ method: 'PUT', url: '/api/searchers/me', payload: { name: 'מנהל' } }),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    }
    expect(await ctx.db.select().from(searchers)).toHaveLength(0);
  });
});
