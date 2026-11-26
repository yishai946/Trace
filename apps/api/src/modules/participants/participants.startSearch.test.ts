import { ApiError, Mission, OwnParticipation, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('Start Search (UC-F06)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let polygonId: string;
  let user: Awaited<ReturnType<typeof signInSearcher>>;
  let id: string;
  let published: MissionEvent[];
  let publish: typeof ctx.realtime.publish;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = injectAs(ctx, await signInCommander(ctx));
    mission = Mission.parse(
      (
        await commander({
          method: 'POST',
          url: '/api/missions',
          payload: {
            name: 'מסע',
            rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
            lkp: {
              position: { type: 'Point', coordinates: [35.137, 31.769] },
              observedAt: '2026-10-03T13:05:00+03:00',
            },
          },
        })
      ).json(),
    );
    const ring = [
      [35.12, 31.77],
      [35.14, 31.77],
      [35.14, 31.79],
      [35.12, 31.77],
    ];
    const polygon = await commander({
      method: 'POST',
      url: `/api/missions/${mission.id}/polygons`,
      payload: { name: 'A', geometry: { type: 'Polygon', coordinates: [ring] } },
    });
    polygonId = (polygon.json() as { id: string }).id;
    user = await signInSearcher(ctx);
    id = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 4,
      searcherId: user.searcherId,
      polygonId,
      taskStatus: 'ready',
    });
    published = [];
    publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      published.push(event);
      publish(event);
    };
  });
  afterEach(() => {
    ctx.realtime.publish = publish;
  });
  afterAll(() => ctx.close());

  const start = (as: typeof user = user) =>
    injectAs(ctx, as)({ method: 'POST', url: `/api/missions/${mission.id}/participation/search/start` });
  const code = async (res: Awaited<ReturnType<typeof start>>) => ApiError.parse(res.json()).error.code;
  const taskOf = async () =>
    (await ctx.db.select().from(participations).where(eq(participations.id, id)))[0]?.taskStatus;

  it('moves the task from Ready to Searching and tells the commander', async () => {
    const res = await start();

    expect(res.statusCode).toBe(200);
    expect(OwnParticipation.parse(res.json())).toMatchObject({
      id,
      status: 'assigned',
      polygonId,
      taskStatus: 'searching',
    });
    expect(await taskOf()).toBe('searching');
    expect(published).toMatchObject([
      { type: 'participant.updated', missionId: mission.id, participant: { id, taskStatus: 'searching' } },
    ]);
  });

  it('is safe to send again: a task already searching stays so and announces nothing', async () => {
    await start();
    published.length = 0;

    const again = await start();
    expect(again.statusCode).toBe(200);
    expect(OwnParticipation.parse(again.json()).taskStatus).toBe('searching');
    expect(published).toEqual([]);
  });

  it('refuses a searcher with no assignment', async () => {
    await ctx.db
      .update(participations)
      .set({ status: 'available', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    const res = await start();
    expect(res.statusCode).toBe(409);
    expect(await code(res)).toBe('NOT_ASSIGNED');
  });

  it('refuses a paused task and a finished one', async () => {
    for (const taskStatus of ['paused', 'finished'] as const) {
      await ctx.db.update(participations).set({ taskStatus }).where(eq(participations.id, id));
      const res = await start();
      expect(res.statusCode).toBe(409);
      expect(await code(res)).toBe('TASK_NOT_READY');
      expect(await taskOf()).toBe(taskStatus);
    }
  });

  it('refuses while the mission is paused or ended', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, mission.id));
    const paused = await start();
    expect(paused.statusCode).toBe(409);
    expect(await code(paused)).toBe('MISSION_NOT_ACTIVE');

    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, mission.id));
    const ended = await start();
    expect(ended.statusCode).toBe(409);
    expect(await code(ended)).toBe('MISSION_ENDED');
    expect(await taskOf()).toBe('ready');
  });

  it('refuses a searcher whose activity ended', async () => {
    await ctx.db
      .update(participations)
      .set({ status: 'ended', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    const res = await start();
    expect(res.statusCode).toBe(409);
    expect(await code(res)).toBe('PARTICIPATION_ENDED');
  });

  it('is for searchers of the mission only', async () => {
    const url = `/api/missions/${mission.id}/participation/search/start`;
    const outsider = injectAs(ctx, await signInSearcher(ctx));
    // A mission the searcher takes no part in is not revealed.
    expect((await outsider({ method: 'POST', url })).statusCode).toBe(404);
    expect((await commander({ method: 'POST', url })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'POST', url })).statusCode).toBe(401);
  });
});
