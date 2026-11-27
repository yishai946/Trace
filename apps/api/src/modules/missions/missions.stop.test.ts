import { ApiError, Mission, OwnMessageList, TimelineEventList, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, trackPoints } from '../../db/schema';
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

const stop = { reason: 'weather', note: 'ערפל כבד, הראות מתחת ל-20 מטר' };

describe('end a mission: the search was stopped (UC-C17)', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;
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
    searcher = await signInSearcher(ctx);
    participationId = await addParticipant(ctx.db, {
      missionId,
      callsign: 3,
      searcherId: searcher.searcherId,
      taskStatus: 'searching',
    });
    published = [];
    ctx.realtime.publish = ((event: MissionEvent) => {
      published.push(event);
    }) as typeof ctx.realtime.publish;
  });
  afterAll(() => ctx.close());

  const end = (payload: unknown = stop, as = inject, id = missionId) =>
    as({ method: 'POST', url: `/api/missions/${id}/stop`, payload: payload as object });
  const current = async () =>
    Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());
  const setStatus = (status: 'paused' | 'ended_located') =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));

  it('stops the search and keeps the reason and the note', async () => {
    const res = await end();
    expect(res.statusCode).toBe(200);
    const mission = Mission.parse(res.json());
    expect(mission.status).toBe('ended_stopped');
    expect(mission.stopped).toMatchObject(stop);
    expect(mission.located).toBeNull();
    expect(Date.parse(mission.stopped?.endedAt ?? '')).not.toBeNaN();
    expect(await current()).toEqual(mission);
  });

  it('keeps the note optional', async () => {
    const res = await end({ reason: 'search_exhausted' });
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).stopped).toMatchObject({ reason: 'search_exhausted', note: null });
  });

  it.each([
    ['no reason', { note: 'x' }],
    ['a reason that is not on the list', { reason: 'bored' }],
    ['nothing', {}],
  ])('rejects %s and changes nothing', async (_name, payload) => {
    const res = await end(payload);
    expect(res.statusCode).toBe(400);
    expect((await current()).status).toBe('active');
  });

  it('stops from Paused', async () => {
    await setStatus('paused');
    const res = await end();
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).status).toBe('ended_stopped');
  });

  it('rejects a mission that already ended and keeps how it ended', async () => {
    await setStatus('ended_located');
    const res = await end();
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    expect((await current()).status).toBe('ended_located');
  });

  it('rejects a second stop and keeps the first reason', async () => {
    await end();
    expect((await end({ reason: 'other' })).statusCode).toBe(409);
    expect((await current()).stopped?.reason).toBe('weather');
  });

  it('is for the commander of the mission only', async () => {
    expect((await end(stop, injectAs(ctx, searcher))).statusCode).toBe(403);
    const other = await signInCommander(ctx);
    expect((await end(stop, injectAs(ctx, other))).statusCode).toBe(404);
    expect((await current()).status).toBe('active');
  });

  it('finishes every open task and keeps the searchers, then tells the mission', async () => {
    const paused = await addParticipant(ctx.db, { missionId, callsign: 5, taskStatus: 'paused' });
    const available = await addParticipant(ctx.db, { missionId, callsign: 6 });
    await end();
    const rows = await ctx.db.select().from(participations).where(eq(participations.missionId, missionId));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(participationId)?.taskStatus).toBe('finished');
    expect(byId.get(paused)?.taskStatus).toBe('finished');
    expect(byId.get(available)).toMatchObject({ status: 'available', taskStatus: null });
    expect(published.filter((e) => e.type === 'participant.updated')).toHaveLength(2);
    expect(published.find((e) => e.type === 'mission.updated')).toMatchObject({ mission: { status: 'ended_stopped' } });
  });

  it('keeps taking safety GPS points from a searcher in the field, until they end their activity', async () => {
    await end();
    const points = (at: string) => ({
      points: [{ position: [35.13, 31.78], recordedAt: at, context: 'safety' }],
    });
    const url = `/api/missions/${missionId}/track-points`;
    const as = injectAs(ctx, searcher);
    expect((await as({ method: 'POST', url, payload: points('2026-10-03T16:50:00+03:00') })).statusCode).toBeLessThan(
      300,
    );
    expect(await ctx.db.select().from(trackPoints)).toHaveLength(1);
    await as({ method: 'POST', url: `/api/missions/${missionId}/participation/finish-activity` });
    expect((await as({ method: 'POST', url, payload: points('2026-10-03T16:55:00+03:00') })).statusCode).toBe(409);
  });

  it('is read-only afterwards', async () => {
    await end();
    const details = await inject({
      method: 'PUT',
      url: `/api/missions/${missionId}/details`,
      payload: { name: 'חדש', missingPerson: {} },
    });
    expect(details.statusCode).toBe(409);
    const message = await inject({
      method: 'POST',
      url: `/api/missions/${missionId}/messages`,
      payload: { body: 'שלום', urgency: 'normal', target: { kind: 'mission' } },
    });
    expect(message.statusCode).toBe(409);
  });

  it('sends the searchers in the field a message and a push; ones who left get none', async () => {
    const gone = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 8, searcherId: gone.searcherId, status: 'ended' });
    await injectAs(
      ctx,
      searcher,
    )({ method: 'PUT', url: '/api/push-token', payload: { token: 'ExponentPushToken[c17]' } });
    ctx.pushSender.sent.length = 0;
    await end();
    const messages = `/api/missions/${missionId}/participation/messages`;
    const own = OwnMessageList.parse((await injectAs(ctx, searcher)({ method: 'GET', url: messages })).json());
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ urgency: 'important', target: { kind: 'mission' } });
    expect(own[0]?.body).toContain('הופסק');
    expect(OwnMessageList.parse((await injectAs(ctx, gone)({ method: 'GET', url: messages })).json())).toEqual([]);
    await expect.poll(() => ctx.pushSender.sent.length).toBe(1);
  });

  it('records "mission ended, search stopped" with the reason on the Timeline', async () => {
    await end();
    const timeline = TimelineEventList.parse(
      (await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` })).json(),
    );
    expect(timeline.at(-1)).toMatchObject({
      type: 'mission.ended',
      details: { outcome: 'stopped' },
      actor: { kind: 'commander' },
    });
    expect(published.some((event) => event.type === 'timeline.recorded')).toBe(true);
  });

  it('works with no searcher in the field: no message, the mission still ends', async () => {
    await ctx.db.update(participations).set({ status: 'ended', taskStatus: null });
    expect((await end()).statusCode).toBe(200);
    expect(published.filter((event) => event.type === 'message.received')).toEqual([]);
  });
});
