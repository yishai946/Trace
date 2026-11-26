import { ApiError, Mission, OwnMessageList, TimelineEventList, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations } from '../../db/schema';
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

describe('pause and resume a mission (UC-C15)', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;
  let joinCode: string;
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
    const mission = Mission.parse(
      (await inject({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } })).json(),
    );
    missionId = mission.id;
    joinCode = mission.joinCode;
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

  const act = (action: 'pause' | 'resume', as = inject, id = missionId) =>
    as({ method: 'POST', url: `/api/missions/${id}/${action}` });
  const current = async () =>
    Mission.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}` })).json());
  const taskOf = async (id = participationId) => {
    const [row] = await ctx.db
      .select({ taskStatus: participations.taskStatus, polygonId: participations.polygonId })
      .from(participations)
      .where(eq(participations.id, id));
    return row;
  };
  const setStatus = (status: 'paused' | 'ended_located' | 'ended_stopped') =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));
  const timelineTypes = async () =>
    TimelineEventList.parse((await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` })).json()).map(
      (event) => event.type,
    );
  const messagesOf = async () =>
    OwnMessageList.parse(
      (
        await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}/participation/messages` })
      ).json(),
    );

  it('pauses an active mission: the searching task pauses and the assignment stays', async () => {
    const res = await act('pause');
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).status).toBe('paused');
    expect((await current()).status).toBe('paused');
    expect(await taskOf()).toEqual({ taskStatus: 'paused', polygonId });
  });

  it('records the pause in the Timeline and tells every client and the searchers', async () => {
    await act('pause');
    expect(await timelineTypes()).toContain('mission.paused');
    expect(published.map((event) => event.type)).toEqual(
      expect.arrayContaining(['mission.updated', 'participant.updated', 'timeline.recorded', 'message.received']),
    );
    const [message] = await messagesOf();
    expect(message?.urgency).toBe('important');
    expect(message?.body).toContain('Rally Point');
  });

  it('keeps a task that is not searching: ready and finished stay as they are', async () => {
    const ready = await addParticipant(ctx.db, { missionId, callsign: 4, polygonId, taskStatus: 'ready' });
    const finished = await addParticipant(ctx.db, { missionId, callsign: 5, polygonId, taskStatus: 'finished' });
    await act('pause');
    expect((await taskOf(ready))?.taskStatus).toBe('ready');
    expect((await taskOf(finished))?.taskStatus).toBe('finished');
  });

  it('blocks a personal Resume and a new join while the mission is paused', async () => {
    await act('pause');
    const resume = await injectAs(
      ctx,
      searcher,
    )({ method: 'POST', url: `/api/missions/${missionId}/participation/search/resume` });
    expect(resume.statusCode).toBe(409);
    expect(ApiError.parse(resume.json()).error.code).toBe('MISSION_NOT_ACTIVE');
    const newcomer = await signInSearcher(ctx, { phoneNumber: '+972501110000' });
    const join = await injectAs(ctx, newcomer)({ method: 'POST', url: `/api/join/${joinCode}` });
    expect(join.statusCode).toBe(409);
  });

  it('resumes: the mission is active, assignments are kept and each searcher must start again', async () => {
    await act('pause');
    const res = await act('resume');
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).status).toBe('active');
    expect(await taskOf()).toEqual({ taskStatus: 'ready', polygonId });
    expect(await timelineTypes()).toEqual(expect.arrayContaining(['mission.paused', 'mission.resumed']));
    const resumed = (await messagesOf()).map((message) => message.body);
    expect(resumed).toHaveLength(2);
    const start = await injectAs(
      ctx,
      searcher,
    )({ method: 'POST', url: `/api/missions/${missionId}/participation/search/start` });
    expect(start.statusCode).toBe(200);
    expect((await taskOf())?.taskStatus).toBe('searching');
  });

  it('answers a repeated pause or resume as it is, with no second event or message', async () => {
    await act('resume');
    expect(await timelineTypes()).not.toContain('mission.resumed');
    await act('pause');
    published = [];
    const again = await act('pause');
    expect(again.statusCode).toBe(200);
    expect(published).toEqual([]);
    expect((await timelineTypes()).filter((type) => type === 'mission.paused')).toHaveLength(1);
    expect(await messagesOf()).toHaveLength(1);
  });

  it('works with no searcher in the field', async () => {
    await ctx.db.update(participations).set({ status: 'ended' }).where(eq(participations.id, participationId));
    expect((await act('pause')).statusCode).toBe(200);
    expect((await current()).status).toBe('paused');
  });

  it.each(['ended_located', 'ended_stopped'] as const)('refuses an ended mission (%s)', async (status) => {
    await setStatus(status);
    for (const action of ['pause', 'resume'] as const) {
      const res = await act(action);
      expect(res.statusCode).toBe(409);
      expect(ApiError.parse(res.json()).error.code).toBe('MISSION_ENDED');
    }
    expect((await current()).status).toBe(status);
  });

  it('is for the mission commander only', async () => {
    expect((await act('pause', injectAs(ctx, searcher))).statusCode).toBe(403);
    const other = await signInCommander(ctx);
    expect((await act('pause', injectAs(ctx, other))).statusCode).toBe(404);
    expect((await current()).status).toBe('active');
    const anonymous = await ctx.app.inject({ method: 'POST', url: `/api/missions/${missionId}/pause` });
    expect(anonymous.statusCode).toBe(401);
  });
});
