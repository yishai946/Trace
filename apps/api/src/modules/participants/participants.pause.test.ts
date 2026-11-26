import { ApiError, Mission, OwnParticipation, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, trackPoints } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('Pause and Resume the search (UC-F07)', () => {
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

  const send = (action: 'pause' | 'resume', as: typeof user = user) =>
    injectAs(ctx, as)({ method: 'POST', url: `/api/missions/${mission.id}/participation/search/${action}` });
  const code = (res: Awaited<ReturnType<typeof send>>) => ApiError.parse(res.json()).error.code;
  const taskOf = async () =>
    (await ctx.db.select().from(participations).where(eq(participations.id, id)))[0]?.taskStatus;
  const setTask = (taskStatus: 'ready' | 'searching' | 'paused' | 'finished') =>
    ctx.db.update(participations).set({ taskStatus }).where(eq(participations.id, id));

  it('pauses a searching task, keeps the assignment and tells the commander', async () => {
    const res = await send('pause');

    expect(res.statusCode).toBe(200);
    expect(OwnParticipation.parse(res.json())).toMatchObject({ id, status: 'assigned', taskStatus: 'paused' });
    expect(await taskOf()).toBe('paused');
    expect(published).toMatchObject([
      { type: 'participant.updated', missionId: mission.id, participant: { id, taskStatus: 'paused' } },
    ]);
  });

  it('resumes a paused task', async () => {
    await setTask('paused');
    const res = await send('resume');

    expect(res.statusCode).toBe(200);
    expect(OwnParticipation.parse(res.json()).taskStatus).toBe('searching');
    expect(published).toMatchObject([{ type: 'participant.updated', participant: { id, taskStatus: 'searching' } }]);
  });

  it('is safe to send again: a task already there stays so and announces nothing', async () => {
    await send('pause');
    published.length = 0;
    const again = await send('pause');
    expect(again.statusCode).toBe(200);
    expect(OwnParticipation.parse(again.json()).taskStatus).toBe('paused');
    expect(published).toEqual([]);
  });

  it('refuses Pause outside Searching and Resume outside Paused', async () => {
    for (const taskStatus of ['ready', 'finished'] as const) {
      await setTask(taskStatus);
      const pause = await send('pause');
      expect(pause.statusCode).toBe(409);
      expect(code(pause)).toBe('TASK_NOT_SEARCHING');
      const resume = await send('resume');
      expect(resume.statusCode).toBe(409);
      expect(code(resume)).toBe('TASK_NOT_PAUSED');
      expect(await taskOf()).toBe(taskStatus);
    }
  });

  it('refuses a Resume while the mission is paused: a mission Pause outranks a personal one', async () => {
    await setTask('paused');
    await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, mission.id));
    const res = await send('resume');
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('MISSION_NOT_ACTIVE');
    expect(await taskOf()).toBe('paused');
  });

  it('refuses once the mission ended or the activity ended', async () => {
    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, mission.id));
    const ended = await send('pause');
    expect(ended.statusCode).toBe(409);
    expect(code(ended)).toBe('MISSION_ENDED');

    await ctx.db.update(missions).set({ status: 'active' }).where(eq(missions.id, mission.id));
    await ctx.db
      .update(participations)
      .set({ status: 'ended', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    const gone = await send('pause');
    expect(gone.statusCode).toBe(409);
    expect(code(gone)).toBe('PARTICIPATION_ENDED');
  });

  it('refuses a searcher with no assignment', async () => {
    await ctx.db
      .update(participations)
      .set({ status: 'available', polygonId: null, taskStatus: null })
      .where(eq(participations.id, id));
    const res = await send('pause');
    expect(res.statusCode).toBe(409);
    expect(code(res)).toBe('NOT_ASSIGNED');
  });

  it('is for searchers of the mission only', async () => {
    const url = `/api/missions/${mission.id}/participation/search/pause`;
    const outsider = injectAs(ctx, await signInSearcher(ctx));
    expect((await outsider({ method: 'POST', url })).statusCode).toBe(404);
    expect((await commander({ method: 'POST', url })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'POST', url })).statusCode).toBe(401);
  });

  it('keeps taking route points while paused, kept as safety points so they stay out of Coverage (decision 71)', async () => {
    await send('pause');
    const upload = await injectAs(ctx, user)({
      method: 'POST',
      url: `/api/missions/${mission.id}/track-points`,
      payload: {
        points: [{ position: [35.13, 31.78], recordedAt: '2026-10-03T13:05:00+03:00', accuracy: 5, context: 'safety' }],
      },
    });
    expect(upload.statusCode).toBe(200);
    const rows = await ctx.db.select({ context: trackPoints.context }).from(trackPoints);
    expect(rows).toEqual([{ context: 'safety' }]);
  });
});
