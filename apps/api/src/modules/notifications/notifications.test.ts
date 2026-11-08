import { ApiError, Mission, MissionPolygon } from '@trace/schemas';
import { eq, sql } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pushTokens, sessions } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../../testing';

const AREA: Polygon = {
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
const message = { title: 'SOS', body: 'מחפש בסכנה' };

const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

describe('notifications', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    ctx.pushSender.sent.length = 0;
    ctx.pushSender.invalid.clear();
  });
  afterAll(() => ctx.close());

  const put = (user: TestUser, token: unknown) =>
    injectAs(ctx, user)({ method: 'PUT', url: '/api/push-token', payload: { token } });
  const del = (user: TestUser) => injectAs(ctx, user)({ method: 'DELETE', url: '/api/push-token' });
  const rows = () => ctx.db.select().from(pushTokens);
  const tokenOf = (n: number | string) => `ExponentPushToken[${n}]`;

  describe('push tokens', () => {
    it('stores the token for the signed-in searcher and the session that registered it', async () => {
      const searcher = await signInSearcher(ctx);
      expect((await put(searcher, tokenOf('a'))).statusCode).toBe(204);

      const [session] = await ctx.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, searcher.userId));
      expect(await rows()).toMatchObject([
        { token: tokenOf('a'), searcherId: searcher.searcherId, sessionId: session?.id },
      ]);
    });

    it('keeps one row when the same token is registered again', async () => {
      const searcher = await signInSearcher(ctx);
      expect((await put(searcher, tokenOf('a'))).statusCode).toBe(204);
      expect((await put(searcher, tokenOf('a'))).statusCode).toBe(204);
      expect(await rows()).toHaveLength(1);
    });

    it('replaces the old token when the device gets a new one', async () => {
      const searcher = await signInSearcher(ctx);
      await put(searcher, tokenOf('a'));
      await put(searcher, tokenOf('b'));
      expect((await rows()).map((row) => row.token)).toEqual([tokenOf('b')]);
    });

    it('moves a token to the searcher who signs in on the same device', async () => {
      const first = await signInSearcher(ctx);
      const second = await signInSearcher(ctx);
      await put(first, tokenOf('a'));
      await put(second, tokenOf('a'));
      expect(await rows()).toMatchObject([{ token: tokenOf('a'), searcherId: second.searcherId }]);
    });

    it('keeps a token per signed-in device', async () => {
      const phone = await signInSearcher(ctx);
      const tablet = await signInSearcher(ctx, phone.phoneNumber);
      await put(phone, tokenOf('a'));
      await put(tablet, tokenOf('b'));
      expect((await rows()).map((row) => row.token).sort()).toEqual([tokenOf('a'), tokenOf('b')]);
    });

    it.each([['abc'], [''], [undefined]])('rejects the malformed token %j', async (token) => {
      const res = await put(await signInSearcher(ctx), token);
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('VALIDATION_ERROR');
      expect(await rows()).toHaveLength(0);
    });

    it('does not let a commander register a token', async () => {
      const res = await put(await signInCommander(ctx), tokenOf('a'));
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
    });

    it("deletes only this device's token, and again without error", async () => {
      const phone = await signInSearcher(ctx);
      const tablet = await signInSearcher(ctx, phone.phoneNumber);
      await put(phone, tokenOf('a'));
      await put(tablet, tokenOf('b'));

      expect((await del(phone)).statusCode).toBe(204);
      expect((await rows()).map((row) => row.token)).toEqual([tokenOf('b')]);
      expect((await del(phone)).statusCode).toBe(204);
    });

    it("deletes the device's token when the searcher signs out", async () => {
      const searcher = await signInSearcher(ctx);
      await put(searcher, tokenOf('a'));
      const res = await injectAs(ctx, searcher)({ method: 'POST', url: '/api/auth/sign-out', payload: {} });
      expect(res.statusCode).toBe(200);
      expect(await rows()).toHaveLength(0);
    });
  });

  describe('notifySearchers', () => {
    let commander: TestUser;
    let missionId: string;
    let polygon1: string;
    let polygon2: string;

    const newMission = async () => {
      const res = await injectAs(
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
      return Mission.parse(res.json()).id;
    };
    const newPolygon = async (mission: string) => {
      const res = await injectAs(
        ctx,
        commander,
      )({
        method: 'POST',
        url: `/api/missions/${mission}/polygons`,
        payload: { geometry: AREA },
      });
      return MissionPolygon.parse(res.json()).id;
    };
    /** A signed-in searcher with a token, who takes part in a mission. */
    const searcherWithToken = async (token: string, participation: Parameters<typeof addParticipant>[1] | null) => {
      const searcher = await signInSearcher(ctx);
      await put(searcher, token);
      if (participation) await addParticipant(ctx.db, { ...participation, searcherId: searcher.searcherId });
      return searcher;
    };
    const sentTokens = () => ctx.pushSender.sent.flatMap((call) => call.tokens).sort();

    beforeEach(async () => {
      commander = await signInCommander(ctx);
      missionId = await newMission();
      polygon1 = await newPolygon(missionId);
      polygon2 = await newPolygon(missionId);
    });

    it('sends only to searchers who are active in the mission and have a token', async () => {
      const otherMission = await newMission();
      await searcherWithToken(tokenOf('available'), { missionId, callsign: 1 });
      await searcherWithToken(tokenOf('assigned'), { missionId, callsign: 2, polygonId: polygon1 });
      await searcherWithToken(tokenOf('ended'), { missionId, callsign: 3, status: 'ended' });
      await addParticipant(ctx.db, { missionId, callsign: 4 });
      await searcherWithToken(tokenOf('elsewhere'), { missionId: otherMission, callsign: 1 });
      await searcherWithToken(tokenOf('nobody'), null);
      const both = await searcherWithToken(tokenOf('both'), { missionId, callsign: 5, status: 'ended' });
      await addParticipant(ctx.db, { missionId: otherMission, callsign: 2, searcherId: both.searcherId });

      const result = await ctx.push.notifySearchers({ missionId, message });

      expect(result).toEqual({ sent: 2, removed: 0 });
      expect(ctx.pushSender.sent).toHaveLength(1);
      expect(sentTokens()).toEqual([tokenOf('assigned'), tokenOf('available')]);
      expect(ctx.pushSender.sent[0]?.message).toEqual(message);
    });

    it('with a polygon, sends only to searchers assigned to it, without the excluded one', async () => {
      const sender = await searcherWithToken(tokenOf('sender'), { missionId, callsign: 1, polygonId: polygon1 });
      await searcherWithToken(tokenOf('other'), { missionId, callsign: 2, polygonId: polygon1 });
      await searcherWithToken(tokenOf('finished'), {
        missionId,
        callsign: 3,
        polygonId: polygon1,
        taskStatus: 'finished',
      });
      await searcherWithToken(tokenOf('elsewhere'), { missionId, callsign: 4, polygonId: polygon2 });
      await searcherWithToken(tokenOf('available'), { missionId, callsign: 5 });

      await ctx.push.notifySearchers({
        missionId,
        polygonId: polygon1,
        excludeSearcherIds: [sender.searcherId],
        message,
      });

      expect(sentTokens()).toEqual([tokenOf('finished'), tokenOf('other')]);
    });

    it('skips searchers whose session has expired', async () => {
      await searcherWithToken(tokenOf('live'), { missionId, callsign: 1 });
      const expired = await searcherWithToken(tokenOf('expired'), { missionId, callsign: 2 });
      await ctx.db
        .update(sessions)
        .set({ expiresAt: sql`now() - interval '1 minute'` })
        .where(eq(sessions.userId, expired.userId));

      await ctx.push.notifySearchers({ missionId, message });

      expect(sentTokens()).toEqual([tokenOf('live')]);
    });

    it('does not call the sender when nobody qualifies', async () => {
      await searcherWithToken(tokenOf('ended'), { missionId, callsign: 1, status: 'ended' });
      const result = await ctx.push.notifySearchers({ missionId, message });
      expect(result).toEqual({ sent: 0, removed: 0 });
      expect(ctx.pushSender.sent).toHaveLength(0);
    });

    it('deletes the tokens Expo says no longer reach a device', async () => {
      await searcherWithToken(tokenOf('dead'), { missionId, callsign: 1 });
      await searcherWithToken(tokenOf('ok'), { missionId, callsign: 2 });
      ctx.pushSender.invalid.add(tokenOf('dead'));

      const result = await ctx.push.notifySearchers({ missionId, message });

      expect(result).toEqual({ sent: 2, removed: 1 });
      expect((await rows()).map((row) => row.token)).toEqual([tokenOf('ok')]);
    });

    it('resolves and keeps every token when the sender throws', async () => {
      await searcherWithToken(tokenOf('a'), { missionId, callsign: 1 });
      ctx.pushSender.failNext(new Error('Expo is down'));

      const result = await ctx.push.notifySearchers({ missionId, message });

      expect(result).toEqual({ sent: 0, removed: 0 });
      expect(await rows()).toHaveLength(1);
    });
  });
});
