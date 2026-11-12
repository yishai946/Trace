import { ApiError, Message, MessageList, Mission, MissionPolygon, OwnMessage, OwnMessageList } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { missions, polygons } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInByPhone,
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
const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;
const tokenOf = (n: string) => `ExponentPushToken[${n}]`;

describe('messages', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;
  let polyA: string;
  let polyB: string;
  let s1: Awaited<ReturnType<typeof signInSearcher>>;
  let p4: string;
  let p5: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  const newMission = async (as: ReturnType<typeof injectAs>) => {
    const res = await as({
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
  const newPolygon = async (id = missionId) => {
    const res = await inject({ method: 'POST', url: `/api/missions/${id}/polygons`, payload: { geometry: AREA } });
    return MissionPolygon.parse(res.json());
  };

  beforeEach(async () => {
    await resetDb(ctx.db);
    ctx.pushSender.sent.length = 0;
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    missionId = await newMission(inject);
    polyA = (await newPolygon()).id;
    polyB = (await newPolygon()).id;
    s1 = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 1, polygonId: polyA, searcherId: s1.searcherId });
    await addParticipant(ctx.db, { missionId, callsign: 2, polygonId: polyA, taskStatus: 'finished' });
    await addParticipant(ctx.db, { missionId, callsign: 3, polygonId: polyB });
    p4 = await addParticipant(ctx.db, { missionId, callsign: 4 });
    p5 = await addParticipant(ctx.db, { missionId, callsign: 5, status: 'ended', polygonId: polyA });
  });

  const url = (id = missionId) => `/api/missions/${id}/messages`;
  const send = (payload: object, as = inject, id = missionId) => as({ method: 'POST', url: url(id), payload });
  const toMission = (urgency = 'normal', body = 'חזרו לכינוס') => ({ target: { kind: 'mission' }, urgency, body });
  const toPolygons = (polygonIds: string[], urgency = 'normal', body = 'חזרו לכינוס') => ({
    target: { kind: 'polygons', polygonIds },
    urgency,
    body,
  });
  const sendOk = async (payload: object) => {
    const res = await send(payload);
    expect(res.statusCode).toBe(201);
    return Message.parse(res.json());
  };
  const list = async () => {
    const res = await inject({ method: 'GET', url: url() });
    expect(res.statusCode).toBe(200);
    return MessageList.parse(res.json());
  };
  const inbox = async (as: TestUser, id = missionId) => {
    const res = await injectAs(ctx, as)({ method: 'GET', url: `/api/missions/${id}/participation/messages` });
    expect(res.statusCode).toBe(200);
    return OwnMessageList.parse(res.json());
  };
  const receipt = (as: TestUser, messageId: string, value: string, id = missionId) =>
    injectAs(ctx, as)({
      method: 'PUT',
      url: `/api/missions/${id}/participation/messages/${messageId}/receipt`,
      payload: { receipt: value },
    });
  const callsigns = (message: Message) => message.recipients.map((r) => r.callsign);

  describe('acceptance', () => {
    it('A1: a polygon message reaches only the searchers assigned to it', async () => {
      const message = await sendOk(toPolygons([polyA]));
      expect(callsigns(message)).toEqual([1, 2]);
      expect(message.recipients.every((r) => r.status === 'sent' && r.deliveredAt === null)).toBe(true);
      expect(message.target).toEqual({ kind: 'polygons', polygons: [{ id: polyA, name: expect.any(String) }] });
    });

    it('A2: a whole-mission message reaches every active participant', async () => {
      expect(callsigns(await sendOk(toMission()))).toEqual([1, 2, 3, 4]);
    });

    it('A3: a searcher cannot send', async () => {
      const res = await send(toMission(), injectAs(ctx, s1));
      expect(res.statusCode).toBe(403);
      expect(errorCode(res)).toBe('FORBIDDEN');
      expect(await list()).toEqual([]);
    });

    it('A4: an ended mission refuses, a paused one allows', async () => {
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      expect((await send(toMission())).statusCode).toBe(201);
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));
      const res = await send(toMission());
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_ENDED');
    });

    it('A5: only a critical message can be acknowledged', async () => {
      for (const urgency of ['normal', 'important']) {
        const message = await sendOk(toMission(urgency));
        const res = await receipt(s1, message.id, 'acknowledged');
        expect(res.statusCode).toBe(409);
        expect(errorCode(res)).toBe('MESSAGE_NOT_CRITICAL');
        expect(callsigns(message)).toContain(1);
        const stored = (await list()).find((m) => m.id === message.id);
        expect(stored?.recipients.find((r) => r.callsign === 1)?.status).toBe('sent');
      }
      const critical = await sendOk(toMission('critical'));
      const res = await receipt(s1, critical.id, 'acknowledged');
      expect(res.statusCode).toBe(200);
      const own = OwnMessage.parse(res.json());
      expect(own.status).toBe('acknowledged');
      expect(own.readAt).not.toBeNull();
      expect(own.deliveredAt).not.toBeNull();
      const stored = (await list()).find((m) => m.id === critical.id);
      expect(stored?.recipients.find((r) => r.callsign === 1)?.status).toBe('acknowledged');
    });

    it('A6: a searcher who was offline gets the message from their inbox', async () => {
      const message = await sendOk(toMission());
      const [own] = await inbox(s1);
      expect(own).toMatchObject({ id: message.id, status: 'sent', deliveredAt: null });

      expect((await receipt(s1, message.id, 'delivered')).statusCode).toBe(200);
      let mine = (await list())[0]?.recipients.find((r) => r.callsign === 1);
      expect(mine?.deliveredAt).not.toBeNull();
      expect(mine?.status).toBe('sent');

      await receipt(s1, message.id, 'read');
      mine = (await list())[0]?.recipients.find((r) => r.callsign === 1);
      expect(mine?.status).toBe('read');
    });
  });

  describe('targets', () => {
    it('E1: one searcher', async () => {
      const message = await sendOk({ target: { kind: 'searcher', participantId: p4 }, urgency: 'normal', body: 'שלום' });
      expect(callsigns(message)).toEqual([4]);
      expect(message.target).toEqual({
        kind: 'searcher',
        participantId: p4,
        callsign: 4,
        name: message.recipients[0]?.name,
      });
    });

    it('E2: one searcher whose activity ended', async () => {
      const res = await send({ target: { kind: 'searcher', participantId: p5 }, urgency: 'normal', body: 'שלום' });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('PARTICIPATION_ENDED');
    });

    it('E3: a participant of another mission', async () => {
      const otherMission = await newMission(inject);
      const other = await addParticipant(ctx.db, { missionId: otherMission, callsign: 1 });
      const res = await send({ target: { kind: 'searcher', participantId: other }, urgency: 'normal', body: 'שלום' });
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    });

    it('E4: a polygon of another mission or a deleted one', async () => {
      const otherMission = await newMission(inject);
      const foreign = (await newPolygon(otherMission)).id;
      const foreignRes = await send(toPolygons([foreign]));
      expect(foreignRes.statusCode).toBe(404);
      expect(errorCode(foreignRes)).toBe('POLYGON_NOT_FOUND');

      await ctx.db.update(polygons).set({ deletedAt: new Date() }).where(eq(polygons.id, polyB));
      const deleted = await send(toPolygons([polyB]));
      expect(deleted.statusCode).toBe(404);
      expect(errorCode(deleted)).toBe('POLYGON_NOT_FOUND');
    });

    it('E5: nobody to send to', async () => {
      const empty = (await newPolygon()).id;
      const res = await send(toPolygons([empty]));
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('NO_RECIPIENTS');

      const other = await newMission(inject);
      await addParticipant(ctx.db, { missionId: other, callsign: 1, status: 'ended' });
      const ended = await send(toMission(), inject, other);
      expect(ended.statusCode).toBe(409);
      expect(errorCode(ended)).toBe('NO_RECIPIENTS');
    });
  });

  describe('validation and access', () => {
    it('E6: refuses invalid bodies and stores the body trimmed', async () => {
      const bad = [
        toMission('normal', ''),
        toMission('normal', '   '),
        toMission('normal', 'א'.repeat(2001)),
        toPolygons([]),
        toPolygons([polyA, polyA]),
        toMission('urgent'),
      ];
      for (const payload of bad) {
        const res = await send(payload);
        expect(res.statusCode).toBe(400);
        expect(errorCode(res)).toBe('VALIDATION_ERROR');
      }
      expect((await sendOk(toMission('normal', '  שלום  '))).body).toBe('שלום');
    });

    it('E7: another commander gets 404', async () => {
      const other = injectAs(ctx, await signInCommander(ctx));
      expect((await send(toMission(), other)).statusCode).toBe(404);
      expect((await other({ method: 'GET', url: url() })).statusCode).toBe(404);
    });

    it('E8: a searcher who joins after the send does not get it', async () => {
      await sendOk(toPolygons([polyA]));
      const late = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 6, polygonId: polyA, searcherId: late.searcherId });
      expect(await inbox(late)).toEqual([]);
    });

    it('E9: a non-recipient searcher sees nothing and cannot report', async () => {
      const message = await sendOk(toPolygons([polyA]));
      const s3 = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 7, polygonId: polyB, searcherId: s3.searcherId });
      expect(await inbox(s3)).toEqual([]);
      expect((await receipt(s3, message.id, 'read')).statusCode).toBe(404);
    });

    it('E10: receipts move forward only', async () => {
      const message = await sendOk(toMission());
      const first = OwnMessage.parse((await receipt(s1, message.id, 'read')).json());
      const earlier = await receipt(s1, message.id, 'delivered');
      expect(earlier.statusCode).toBe(200);
      expect(OwnMessage.parse(earlier.json()).readAt).toBe(first.readAt);
      const again = OwnMessage.parse((await receipt(s1, message.id, 'read')).json());
      expect(again.readAt).toBe(first.readAt);
    });

    it('E11: the commander cannot post receipts; a searcher without a profile has no inbox', async () => {
      const message = await sendOk(toMission());
      const res = await receipt(commander, message.id, 'read');
      expect(res.statusCode).toBe(403);
      const noProfile = await signInByPhone(ctx);
      const inboxRes = await injectAs(ctx, noProfile)({ method: 'GET', url: `/api/missions/${missionId}/participation/messages` });
      expect(inboxRes.statusCode).toBe(403);
    });

    it('E12: lists newest first and keeps messages after the mission ends', async () => {
      const first = await sendOk(toMission('normal', 'ראשונה'));
      const second = await sendOk(toMission('normal', 'שנייה'));
      await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, missionId));
      expect((await list()).map((m) => m.id)).toEqual([second.id, first.id]);
    });
  });

  describe('push', () => {
    const putToken = (user: TestUser, token: string) =>
      injectAs(ctx, user)({ method: 'PUT', url: '/api/push-token', payload: { token } });

    it('E13: goes to the recipients only', async () => {
      const s3 = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 8, polygonId: polyB, searcherId: s3.searcherId });
      await putToken(s1, tokenOf('s1'));
      await putToken(s3, tokenOf('s3'));
      const message = await sendOk(toPolygons([polyA], 'critical', 'חזרו'));
      await vi.waitFor(() => expect(ctx.pushSender.sent).toHaveLength(1));
      expect(ctx.pushSender.sent[0]?.tokens).toEqual([tokenOf('s1')]);
      expect(ctx.pushSender.sent[0]?.message).toEqual({
        title: 'הודעה קריטית מהמנהל',
        body: 'חזרו',
        data: { missionId, screen: 'messages' },
      });
      expect(message.id).toBeDefined();
    });

    it('E14: a push failure does not fail the send', async () => {
      await putToken(s1, tokenOf('s1'));
      ctx.pushSender.failNext(new Error('down'));
      expect((await send(toMission())).statusCode).toBe(201);
    });
  });
});
