import {
  ApiError,
  Mission,
  OwnMessageList,
  TimelineEventList,
  type MissionEvent,
  type Participant,
} from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assignments, missions, participations, trackPoints } from '../../db/schema';
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
import { lkp, rallyPoint } from './fixtures';

const ring = [
  [35.12, 31.77],
  [35.14, 31.77],
  [35.14, 31.79],
  [35.12, 31.77],
];
const located = {
  position: { type: 'Point', coordinates: [35.131, 31.775] },
  locatedAt: '2026-10-03T16:40:00+03:00',
  note: 'נמצא בריא, מתחת לעץ',
};

describe('end a mission: the missing person was located (UC-C16)', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;
  let polygonId: string;
  let searcher: Awaited<ReturnType<typeof signInSearcher>>;
  let participationId: string;
  let published: MissionEvent[];

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    missionId = Mission.parse(
      (await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } })).json(),
    ).id;
    const polygon = await inject({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { name: 'A', geometry: { type: 'Polygon', coordinates: [ring] } },
    });
    polygonId = (polygon.json() as { id: string }).id;
    searcher = await signInSearcher(ctx);
    participationId = await addParticipant(ctx.db, {
      missionId,
      callsign: 3,
      searcherId: searcher.searcherId,
      polygonId,
      taskStatus: 'searching',
    });
    published = [];
    ctx.realtime.publish = ((event: MissionEvent) => {
      published.push(event);
    }) as typeof ctx.realtime.publish;
  });
  afterAll(() => ctx.close());

  const end = (payload: unknown = located, as = inject, id = missionId) =>
    as({ method: 'POST', url: `/api/missions/${id}/end-located`, payload: payload as object });
  const current = async () =>
    Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());
  const setStatus = (status: 'paused' | 'ended_stopped') =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));

  it('ends the mission as located and keeps where, when and the note', async () => {
    const res = await end();
    expect(res.statusCode).toBe(200);
    const mission = Mission.parse(res.json());
    expect(mission.status).toBe('ended_located');
    expect(mission.located).toMatchObject({
      position: located.position,
      locatedAt: '2026-10-03T13:40:00.000Z',
      note: located.note,
    });
    expect(Date.parse(mission.located?.endedAt ?? '')).not.toBeNaN();
    expect(await current()).toEqual(mission);
  });

  it('keeps the note optional', async () => {
    const res = await end({ position: located.position, locatedAt: located.locatedAt });
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).located?.note).toBeNull();
  });

  it.each([
    ['no position', { locatedAt: located.locatedAt }],
    ['no time', { position: located.position }],
    ['an invalid time', { ...located, locatedAt: 'yesterday' }],
    ['nothing', {}],
  ])('rejects %s and changes nothing', async (_name, payload) => {
    const res = await end(payload);
    expect(res.statusCode).toBe(400);
    expect((await current()).status).toBe('active');
  });

  it('rejects a located time in the future and changes nothing', async () => {
    const res = await end({ ...located, locatedAt: new Date(Date.now() + 60 * 60_000).toISOString() });
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect((await current()).status).toBe('active');
  });

  it('ends the mission from Paused', async () => {
    await setStatus('paused');
    const res = await end();
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).status).toBe('ended_located');
  });

  it.each(['ended_stopped'] as const)('rejects a mission that already ended (%s)', async (status) => {
    await setStatus(status);
    const res = await end();
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    expect((await current()).status).toBe(status);
  });

  it('rejects a second ending and keeps the first', async () => {
    await end();
    const again = await end({ ...located, note: 'אחר' });
    expect(again.statusCode).toBe(409);
    expect((await current()).located?.note).toBe(located.note);
  });

  it('is for the commander of the mission only', async () => {
    expect((await end(located, injectAs(ctx, searcher))).statusCode).toBe(403);
    const other = await signInCommander(ctx);
    expect((await end(located, injectAs(ctx, other))).statusCode).toBe(404);
    expect((await end(located, inject, '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    expect((await current()).status).toBe('active');
  });

  describe('the search', () => {
    it('finishes every open task and keeps the searcher, the assignment and the polygon', async () => {
      const waiting = await addParticipant(ctx.db, {
        missionId,
        callsign: 4,
        polygonId,
        taskStatus: 'ready',
      });
      const paused = await addParticipant(ctx.db, {
        missionId,
        callsign: 5,
        polygonId,
        taskStatus: 'paused',
      });
      const available = await addParticipant(ctx.db, { missionId, callsign: 6 });
      await end();
      const rows = await ctx.db.select().from(participations).where(eq(participations.missionId, missionId));
      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const id of [participationId, waiting, paused]) {
        expect(byId.get(id)).toMatchObject({ status: 'assigned', polygonId, taskStatus: 'finished' });
      }
      expect(byId.get(available)).toMatchObject({ status: 'available', taskStatus: null });
      const open = await ctx.db.select().from(assignments);
      expect(open.every((row) => row.endedAt === null)).toBe(true);
    });

    it('tells the mission about each task that finished', async () => {
      await end();
      const updated = published.filter((event) => event.type === 'participant.updated');
      expect(updated).toHaveLength(1);
      const event = updated[0];
      const participant: Participant | undefined =
        event?.type === 'participant.updated' ? event.participant : undefined;
      expect(participant).toMatchObject({ id: participationId, taskStatus: 'finished' });
      expect(published.find((e) => e.type === 'mission.updated')).toMatchObject({
        mission: { status: 'ended_located' },
      });
    });

    it('still takes GPS points from a searcher who is in the field, as safety points', async () => {
      await end();
      const res = await injectAs(
        ctx,
        searcher,
      )({
        method: 'POST',
        url: `/api/missions/${missionId}/track-points`,
        payload: {
          points: [{ position: [35.13, 31.78], recordedAt: '2026-10-03T16:50:00+03:00', context: 'safety' }],
        },
      });
      expect(res.statusCode).toBeLessThan(300);
      expect(await ctx.db.select().from(trackPoints)).toHaveLength(1);
    });

    it('stops taking points once the searcher ended their activity', async () => {
      await end();
      const done = await injectAs(
        ctx,
        searcher,
      )({ method: 'POST', url: `/api/missions/${missionId}/participation/finish-activity` });
      expect(done.statusCode).toBe(200);
      const res = await injectAs(
        ctx,
        searcher,
      )({
        method: 'POST',
        url: `/api/missions/${missionId}/track-points`,
        payload: {
          points: [{ position: [35.13, 31.78], recordedAt: '2026-10-03T16:55:00+03:00', context: 'safety' }],
        },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('the mission is read-only afterwards', () => {
    beforeEach(async () => {
      await end();
    });

    it('refuses editing the details, the rally point and the polygons', async () => {
      const details = await inject({
        method: 'PUT',
        url: `/api/missions/${missionId}/details`,
        payload: { name: 'חדש', missingPerson: {} },
      });
      expect(details.statusCode).toBe(409);
      const rally = await inject({
        method: 'PUT',
        url: `/api/missions/${missionId}/rally-point`,
        payload: { rallyPoint },
      });
      expect(rally.statusCode).toBe(409);
      const polygon = await inject({
        method: 'POST',
        url: `/api/missions/${missionId}/polygons`,
        payload: { name: 'B', geometry: { type: 'Polygon', coordinates: [ring] } },
      });
      expect(polygon.statusCode).toBe(409);
    });

    it('refuses an assignment', async () => {
      const spare = await addParticipant(ctx.db, { missionId, callsign: 7 });
      const res = await inject({
        method: 'PUT',
        url: `/api/missions/${missionId}/participants/${spare}/assignment`,
        payload: { polygonId },
      });
      expect(res.statusCode).toBe(409);
    });

    it('refuses a new report and a new message', async () => {
      const report = await injectAs(
        ctx,
        searcher,
      )({
        method: 'POST',
        url: `/api/missions/${missionId}/reports`,
        payload: {
          id: '0199f1a0-0000-7000-8000-000000000001',
          type: 'general',
          text: 'משהו',
          position: { type: 'Point', coordinates: [35.13, 31.78] },
          reportedAt: '2026-10-03T16:45:00+03:00',
        },
      });
      expect(report.statusCode).toBe(409);
      const message = await inject({
        method: 'POST',
        url: `/api/missions/${missionId}/messages`,
        payload: { body: 'שלום', urgency: 'normal', target: { kind: 'mission' } },
      });
      expect(message.statusCode).toBe(409);
    });
  });

  describe('the searchers and the Timeline', () => {
    it('sends every searcher in the field a message, offline ones read it when they are back', async () => {
      const gone = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 8, searcherId: gone.searcherId, status: 'ended' });
      await end();
      const own = OwnMessageList.parse(
        (
          await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}/participation/messages` })
        ).json(),
      );
      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ urgency: 'important', target: { kind: 'mission' } });
      expect(own[0]?.body).toContain('הנעדר אותר');
      const none = OwnMessageList.parse(
        (await injectAs(ctx, gone)({ method: 'GET', url: `/api/missions/${missionId}/participation/messages` })).json(),
      );
      expect(none).toEqual([]);
      expect(published.filter((event) => event.type === 'message.received')).toHaveLength(1);
    });

    it('sends a push notification to the searchers in the field', async () => {
      await injectAs(
        ctx,
        searcher,
      )({ method: 'PUT', url: '/api/push-token', payload: { token: 'ExponentPushToken[c16]' } });
      ctx.pushSender.sent.length = 0;
      await end();
      await expect.poll(() => ctx.pushSender.sent.length).toBe(1);
      expect(ctx.pushSender.sent[0]?.tokens).toEqual(['ExponentPushToken[c16]']);
    });

    it('records "mission ended, located" on the Timeline and tells the mission', async () => {
      await end();
      const timeline = TimelineEventList.parse(
        (await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` })).json(),
      );
      expect(timeline.at(-1)).toMatchObject({
        type: 'mission.ended',
        details: { outcome: 'located' },
        actor: { kind: 'commander' },
        subject: { kind: 'mission' },
      });
      expect(published.some((event) => event.type === 'timeline.recorded')).toBe(true);
    });

    it('works with no searcher in the field: no message, the mission still ends', async () => {
      await ctx.db.update(participations).set({ status: 'ended', taskStatus: null });
      const res = await end();
      expect(res.statusCode).toBe(200);
      expect(published.filter((event) => event.type === 'message.received')).toEqual([]);
    });
  });
});
