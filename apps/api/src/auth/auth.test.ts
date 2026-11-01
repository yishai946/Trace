import { ApiError, Mission, MissionList, MissionPolygon } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../testing';

const rallyPoint = { type: 'Point', coordinates: [35.13, 31.78] };
const area: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [35.122, 31.77],
      [35.136, 31.77],
      [35.136, 31.781],
      [35.122, 31.781],
      [35.122, 31.77],
    ],
  ],
};

const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

describe('auth', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx.db));
  afterAll(() => ctx.close());

  const createMissionAs = async (user: TestUser, name = 'מסע') => {
    const res = await injectAs(ctx, user)({ method: 'POST', url: '/api/missions', payload: { name, rallyPoint } });
    expect(res.statusCode).toBe(201);
    return Mission.parse(res.json());
  };

  describe('sign-in', () => {
    it('answers 401 on every protected route without a session, and keeps health public', async () => {
      const id = '00000000-0000-4000-8000-000000000000';
      const routes = [
        { method: 'GET', url: '/api/missions' },
        { method: 'POST', url: '/api/missions' },
        { method: 'GET', url: `/api/missions/${id}` },
        { method: 'GET', url: `/api/missions/${id}/polygons` },
        { method: 'POST', url: `/api/missions/${id}/polygons` },
        { method: 'PATCH', url: `/api/missions/${id}/polygons/${id}` },
        { method: 'DELETE', url: `/api/missions/${id}/polygons/${id}` },
        { method: 'GET', url: `/api/missions/${id}/participants` },
      ] as const;
      for (const route of routes) {
        const res = await ctx.app.inject(route);
        expect(res.statusCode, `${route.method} ${route.url}`).toBe(401);
        expect(errorCode(res)).toBe('UNAUTHENTICATED');
      }
      expect((await ctx.app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    });

    it('rejects a wrong password and a forged session token', async () => {
      const commander = await signInCommander(ctx);
      const [user] = await ctx.db.select({ email: users.email }).from(users).where(eq(users.id, commander.userId));
      const wrong = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: user?.email, password: 'not-the-password' },
      });
      expect(wrong.statusCode).toBe(401);
      expect(wrong.headers['set-cookie']).toBeUndefined();

      const forged = await ctx.app.inject({
        method: 'GET',
        url: '/api/missions',
        headers: { authorization: 'Bearer forged-token' },
      });
      expect(forged.statusCode).toBe(401);
    });

    it('has no public sign-up for commanders', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: 'new@trace.test', password: 'correct-horse-battery', name: 'מנהל' },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(await ctx.db.select().from(users)).toHaveLength(0);
    });

    it('signs a searcher up as a searcher on the first verified OTP, and rejects a wrong code', async () => {
      const phoneNumber = '+972541234567';
      await ctx.app.inject({ method: 'POST', url: '/api/auth/phone-number/send-otp', payload: { phoneNumber } });
      const wrong = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/phone-number/verify',
        payload: { phoneNumber, code: ctx.sentCodes.get(phoneNumber) === '000000' ? '111111' : '000000' },
      });
      expect(wrong.statusCode).toBe(400);

      const searcher = await signInSearcher(ctx);
      const [user] = await ctx.db.select({ role: users.role }).from(users).where(eq(users.id, searcher.userId));
      expect(user?.role).toBe('searcher');
    });

    it('does not send a code to a malformed phone number', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/phone-number/send-otp',
        payload: { phoneNumber: '0501234567' },
      });
      expect(res.statusCode).toBe(400);
      expect(ctx.sentCodes.has('0501234567')).toBe(false);
    });

    it('does not let a user change their own role', async () => {
      const searcher = await signInSearcher(ctx);
      await injectAs(ctx, searcher)({ method: 'POST', url: '/api/auth/update-user', payload: { role: 'commander' } });
      const [user] = await ctx.db.select({ role: users.role }).from(users).where(eq(users.id, searcher.userId));
      expect(user?.role).toBe('searcher');
      const res = await injectAs(
        ctx,
        searcher,
      )({ method: 'POST', url: '/api/missions', payload: { name: 'x', rallyPoint } });
      expect(res.statusCode).toBe(403);
    });

    it('ends the session on sign-out', async () => {
      const commander = await signInCommander(ctx);
      const inject = injectAs(ctx, commander);
      expect((await inject({ method: 'GET', url: '/api/missions' })).statusCode).toBe(200);
      await inject({ method: 'POST', url: '/api/auth/sign-out', payload: {} });
      expect((await inject({ method: 'GET', url: '/api/missions' })).statusCode).toBe(401);
    });
  });

  describe('commanders', () => {
    it("see and manage only their own missions; another commander's mission answers 404", async () => {
      const owner = await signInCommander(ctx);
      const other = await signInCommander(ctx);
      const mission = await createMissionAs(owner);
      await createMissionAs(other, 'אחר');

      const list = MissionList.parse((await injectAs(ctx, owner)({ method: 'GET', url: '/api/missions' })).json());
      expect(list.map((m) => m.id)).toEqual([mission.id]);

      const asOther = injectAs(ctx, other);
      const base = `/api/missions/${mission.id}`;
      for (const res of [
        await asOther({ method: 'GET', url: base }),
        await asOther({ method: 'GET', url: `${base}/polygons` }),
        await asOther({ method: 'POST', url: `${base}/polygons`, payload: { geometry: area } }),
        await asOther({ method: 'GET', url: `${base}/participants` }),
      ]) {
        expect(res.statusCode).toBe(404);
        expect(errorCode(res)).toBe('NOT_FOUND');
      }
    });
  });

  describe('searchers', () => {
    let commander: TestUser;
    let mission: Mission;
    let polygon: MissionPolygon;

    beforeEach(async () => {
      commander = await signInCommander(ctx);
      mission = await createMissionAs(commander);
      const res = await injectAs(
        ctx,
        commander,
      )({
        method: 'POST',
        url: `/api/missions/${mission.id}/polygons`,
        payload: { geometry: area },
      });
      polygon = MissionPolygon.parse(res.json());
    });

    it('cannot create missions', async () => {
      const searcher = await signInSearcher(ctx);
      const res = await injectAs(
        ctx,
        searcher,
      )({ method: 'POST', url: '/api/missions', payload: { name: 'x', rallyPoint } });
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    });

    it('read the missions they take part in and their map, without commander actions (spec §7, UC-F04)', async () => {
      const searcher = await signInSearcher(ctx);
      if (!searcher.searcherId) throw new Error('Searcher has no profile');
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });
      await createMissionAs(commander, 'מסע אחר');
      const inject = injectAs(ctx, searcher);
      const base = `/api/missions/${mission.id}`;

      const list = MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json());
      expect(list.map((m) => m.id)).toEqual([mission.id]);
      expect((await inject({ method: 'GET', url: base })).statusCode).toBe(200);
      expect((await inject({ method: 'GET', url: `${base}/polygons` })).statusCode).toBe(200);

      for (const res of [
        await inject({ method: 'GET', url: `${base}/participants` }),
        await inject({ method: 'POST', url: `${base}/polygons`, payload: { geometry: area } }),
        await inject({ method: 'PATCH', url: `${base}/polygons/${polygon.id}`, payload: { name: 'x' } }),
        await inject({ method: 'DELETE', url: `${base}/polygons/${polygon.id}` }),
      ]) {
        expect(res.statusCode).toBe(403);
        expect(errorCode(res)).toBe('FORBIDDEN');
      }
    });

    it('get 404 for a mission they are not part of, and see none before they have a profile', async () => {
      const outsider = await signInSearcher(ctx);
      const res = await injectAs(ctx, outsider)({ method: 'GET', url: `/api/missions/${mission.id}` });
      expect(res.statusCode).toBe(404);

      const newcomer = await signInSearcher(ctx, { withProfile: false });
      const inject = injectAs(ctx, newcomer);
      expect(MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json())).toEqual([]);
      expect((await inject({ method: 'GET', url: `/api/missions/${mission.id}` })).statusCode).toBe(404);
    });
  });
});
