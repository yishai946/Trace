import { ApiError, AuthSession, Mission, MissionList, MissionPolygon } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { otpRequests, searchers, users, verifications } from '../db/schema';
import { OTP_REQUEST_LIMIT } from '.';
import {
  addParticipant,
  createTestApp,
  injectAs,
  requestOtp,
  resetDb,
  signInByPhone,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
  verifyOtp,
} from '../testing';

const rallyPoint = { type: 'Point', coordinates: [35.13, 31.78] };
const lkp = { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' };
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
    const res = await injectAs(ctx, user)({ method: 'POST', url: '/api/missions', payload: { name, rallyPoint, lkp } });
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
        { method: 'GET', url: '/api/searchers/me' },
        { method: 'PUT', url: '/api/searchers/me' },
        { method: 'PUT', url: '/api/push-token' },
        { method: 'DELETE', url: '/api/push-token' },
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

    const wrongCodeFor = (phoneNumber: string) => (ctx.sentCodes.get(phoneNumber) === '000000' ? '111111' : '000000');
    const bodyCode = (res: { json: () => unknown }) => (res.json() as { code?: string }).code;

    it('returns a session for the right code', async () => {
      const phoneNumber = '+972541234567';
      expect((await requestOtp(ctx, phoneNumber)).statusCode).toBe(200);
      const res = await verifyOtp(ctx, phoneNumber, ctx.sentCodes.get(phoneNumber) ?? '');
      expect(res.statusCode).toBe(200);
      const body = res.json<{ token?: string; user?: { id: string } }>();
      expect(body.token).toBeTruthy();
      expect(body.user?.id).toBeTruthy();
      expect(res.headers['set-cookie']).toBeDefined();

      const session = await ctx.app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        headers: { authorization: `Bearer ${body.token}` },
      });
      expect(session.statusCode).toBe(200);
      expect(AuthSession.parse(session.json())?.user.role).toBe('searcher');
    });

    it('rejects a wrong code and accepts a new one', async () => {
      const phoneNumber = '+972541234567';
      await requestOtp(ctx, phoneNumber);
      const wrong = await verifyOtp(ctx, phoneNumber, wrongCodeFor(phoneNumber));
      expect(wrong.statusCode).toBe(400);
      expect(bodyCode(wrong)).toBe('INVALID_OTP');
      expect(wrong.headers['set-cookie']).toBeUndefined();
      expect(await ctx.db.select().from(users)).toHaveLength(0);

      await requestOtp(ctx, phoneNumber);
      expect((await verifyOtp(ctx, phoneNumber, ctx.sentCodes.get(phoneNumber) ?? '')).statusCode).toBe(200);
    });

    it('rejects an expired code and accepts a new one', async () => {
      const phoneNumber = '+972541234567';
      await requestOtp(ctx, phoneNumber);
      await ctx.db
        .update(verifications)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(verifications.identifier, phoneNumber));
      const expired = await verifyOtp(ctx, phoneNumber, ctx.sentCodes.get(phoneNumber) ?? '');
      expect(expired.statusCode).toBe(400);
      expect(bodyCode(expired)).toBe('OTP_EXPIRED');
      expect(expired.headers['set-cookie']).toBeUndefined();

      await requestOtp(ctx, phoneNumber);
      expect((await verifyOtp(ctx, phoneNumber, ctx.sentCodes.get(phoneNumber) ?? '')).statusCode).toBe(200);
    });

    it('stops accepting a code after too many wrong tries', async () => {
      const phoneNumber = '+972541234567';
      await requestOtp(ctx, phoneNumber);
      const rightCode = ctx.sentCodes.get(phoneNumber) ?? '';
      let last = await verifyOtp(ctx, phoneNumber, wrongCodeFor(phoneNumber));
      for (let tries = 1; tries < 10 && last.statusCode !== 403; tries += 1) {
        last = await verifyOtp(ctx, phoneNumber, wrongCodeFor(phoneNumber));
      }
      expect(last.statusCode).toBe(403);
      expect(bodyCode(last)).toBe('TOO_MANY_ATTEMPTS');
      expect((await verifyOtp(ctx, phoneNumber, rightCode)).statusCode).toBeGreaterThanOrEqual(400);

      await requestOtp(ctx, phoneNumber);
      expect((await verifyOtp(ctx, phoneNumber, ctx.sentCodes.get(phoneNumber) ?? '')).statusCode).toBe(200);
    });

    it('signs the same phone in as the same user', async () => {
      const phoneNumber = '+972549876543';
      const first = await signInByPhone(ctx, phoneNumber);
      const second = await signInByPhone(ctx, phoneNumber);
      expect(second.userId).toBe(first.userId);
      expect(await ctx.db.select().from(users).where(eq(users.phoneNumber, phoneNumber))).toHaveLength(1);
    });

    it('creates no searcher profile until the name is entered', async () => {
      const user = await signInByPhone(ctx);
      expect(await ctx.db.select().from(searchers)).toHaveLength(0);
      const res = await injectAs(ctx, user)({ method: 'GET', url: '/api/missions' });
      expect(res.statusCode).toBe(200);
      expect(MissionList.parse(res.json())).toEqual([]);
    });

    it('does not send a code to a malformed phone number', async () => {
      ctx.sentOtps.length = 0;
      for (const phoneNumber of ['0501234567', '+972', '972541234567', '+97254abc4567']) {
        const res = await requestOtp(ctx, phoneNumber);
        expect(res.statusCode, phoneNumber).toBe(400);
      }
      expect(ctx.sentOtps).toHaveLength(0);
      expect(await ctx.db.select().from(otpRequests)).toHaveLength(0);
    });

    describe('code request limit', () => {
      const exhaust = async (phoneNumber: string) => {
        for (let count = 0; count < OTP_REQUEST_LIMIT.max; count += 1) {
          expect((await requestOtp(ctx, phoneNumber)).statusCode).toBe(200);
        }
      };
      afterEach(() => {
        vi.useRealTimers();
      });

      it('blocks a number after too many code requests, without sending', async () => {
        const phoneNumber = '+972541111111';
        await exhaust(phoneNumber);
        const lastCode = ctx.sentCodes.get(phoneNumber) ?? '';
        const blocked = await requestOtp(ctx, phoneNumber);
        expect(blocked.statusCode).toBe(429);
        expect(bodyCode(blocked)).toBe('TOO_MANY_OTP_REQUESTS');
        const retryAfter = Number(blocked.headers['retry-after']);
        expect(Number.isInteger(retryAfter)).toBe(true);
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(OTP_REQUEST_LIMIT.windowSeconds);
        expect(ctx.sentOtps.filter((sent) => sent.phoneNumber === phoneNumber)).toHaveLength(OTP_REQUEST_LIMIT.max);
        expect((await verifyOtp(ctx, phoneNumber, lastCode)).statusCode).toBe(200);
      });

      it('limits each number on its own', async () => {
        await exhaust('+972541111111');
        expect((await requestOtp(ctx, '+972542222222')).statusCode).toBe(200);
      });

      it('purges expired requests of numbers that never ask again', async () => {
        const gone = '+972543333333';
        await ctx.db.insert(otpRequests).values({
          phone: gone,
          requestedAt: new Date(Date.now() - (OTP_REQUEST_LIMIT.windowSeconds + 1) * 1000),
        });
        expect((await requestOtp(ctx, '+972542222222')).statusCode).toBe(200);
        const rows = await ctx.db.select().from(otpRequests).where(eq(otpRequests.phone, gone));
        expect(rows).toHaveLength(0);
      });

      it('lets a blocked number request again after the window', async () => {
        const phoneNumber = '+972541111111';
        vi.useFakeTimers({ toFake: ['Date'] });
        const start = Date.now();
        vi.setSystemTime(start);
        await exhaust(phoneNumber);
        expect((await requestOtp(ctx, phoneNumber)).statusCode).toBe(429);
        vi.setSystemTime(start + (OTP_REQUEST_LIMIT.windowSeconds + 1) * 1000);
        expect((await requestOtp(ctx, phoneNumber)).statusCode).toBe(200);
      });
    });

    it('does not let a user change their own role', async () => {
      const searcher = await signInSearcher(ctx);
      await injectAs(ctx, searcher)({ method: 'POST', url: '/api/auth/update-user', payload: { role: 'commander' } });
      const [user] = await ctx.db.select({ role: users.role }).from(users).where(eq(users.id, searcher.userId));
      expect(user?.role).toBe('searcher');
      const res = await injectAs(
        ctx,
        searcher,
      )({ method: 'POST', url: '/api/missions', payload: { name: 'x', rallyPoint, lkp } });
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
      )({ method: 'POST', url: '/api/missions', payload: { name: 'x', rallyPoint, lkp } });
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    });

    it('read the missions they take part in and their map, without commander actions (spec §7, UC-F04)', async () => {
      const searcher = await signInSearcher(ctx);
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

    it('get 404 for a mission they are not part of, and see no missions before joining one', async () => {
      const outsider = await signInSearcher(ctx);
      const inject = injectAs(ctx, outsider);
      expect((await inject({ method: 'GET', url: `/api/missions/${mission.id}` })).statusCode).toBe(404);
      expect(MissionList.parse((await inject({ method: 'GET', url: '/api/missions' })).json())).toEqual([]);
    });
  });
});
