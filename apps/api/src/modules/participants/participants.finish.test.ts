import { ApiError, Mission, OwnParticipation, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, polygons, trackPoints } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('Finish the search (UC-F08)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
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
    user = await signInSearcher(ctx);
    id = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 4,
      searcherId: user.searcherId,
      polygonId: (polygon.json() as { id: string }).id,
      taskStatus: 'searching',
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

  const url = () => `/api/missions/${mission.id}/participation/search/finish`;
  const send = (as: typeof user = user) => injectAs(ctx, as)({ method: 'POST', url: url() });
  const code = (res: Awaited<ReturnType<typeof send>>) => ApiError.parse(res.json()).error.code;
  const rowOf = async () => (await ctx.db.select().from(participations).where(eq(participations.id, id)))[0];
  const setTask = (taskStatus: 'ready' | 'searching' | 'paused' | 'finished') =>
    ctx.db.update(participations).set({ taskStatus }).where(eq(participations.id, id));

  it.each(['searching', 'paused'] as const)(
    'finishes a %s task, keeps the assignment and tells the commander',
    async (from) => {
      await setTask(from);
      const before = await rowOf();
      const res = await send();

      expect(res.statusCode).toBe(200);
      expect(OwnParticipation.parse(res.json())).toMatchObject({ id, status: 'assigned', taskStatus: 'finished' });
      expect(await rowOf()).toMatchObject({ status: 'assigned', polygonId: before?.polygonId, taskStatus: 'finished' });
      expect(published).toMatchObject([
        { type: 'participant.updated', missionId: mission.id, participant: { id, taskStatus: 'finished' } },
      ]);
    },
  );

  it('does not change the polygon status and keeps the route collected', async () => {
    const upload = await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${mission.id}/track-points`,
      payload: {
        points: [{ position: [35.13, 31.78], recordedAt: '2026-10-03T13:05:00+03:00', accuracy: 5, context: 'search' }],
      },
    });
    expect(upload.statusCode).toBe(200);
    const polygonsBefore = await ctx.db.select().from(polygons);

    expect((await send()).statusCode).toBe(200);

    expect(await ctx.db.select().from(polygons)).toEqual(polygonsBefore);
    expect(polygonsBefore[0]?.status).not.toBe('completed');
    expect(await ctx.db.select({ context: trackPoints.context }).from(trackPoints)).toEqual([{ context: 'search' }]);
  });

  it('is safe to send again: a finished task stays so and announces nothing', async () => {
    await send();
    published.length = 0;
    const again = await send();
    expect(again.statusCode).toBe(200);
    expect(OwnParticipation.parse(again.json()).taskStatus).toBe('finished');
    expect(published).toEqual([]);
  });

  it('refuses a task that never started', async () => {
    await setTask('ready');
    const res = await send();
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('TASK_NOT_ACTIVE');
    expect((await rowOf())?.taskStatus).toBe('ready');
  });

  it('refuses while the mission is paused, and once it ended or the activity ended', async () => {
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, mission.id));
    const paused = await send();
    expect(paused.statusCode).toBe(409);
    expect(code(paused)).toBe('MISSION_NOT_ACTIVE');

    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, mission.id));
    expect(code(await send())).toBe('MISSION_ENDED');

    await ctx.db.update(missions).set({ status: 'active' }).where(eq(missions.id, mission.id));
    await ctx.db
      .update(participations)
      .set({ status: 'ended', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    expect(code(await send())).toBe('PARTICIPATION_ENDED');
    expect((await rowOf())?.status).toBe('ended');
  });

  it('refuses a searcher with no assignment', async () => {
    await ctx.db
      .update(participations)
      .set({ status: 'available', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    const res = await send();
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('NOT_ASSIGNED');
  });

  it('is for searchers of the mission only', async () => {
    const outsider = injectAs(ctx, await signInSearcher(ctx));
    expect((await outsider({ method: 'POST', url: url() })).statusCode).toBe(404);
    expect((await commander({ method: 'POST', url: url() })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'POST', url: url() })).statusCode).toBe(401);
  });
});
