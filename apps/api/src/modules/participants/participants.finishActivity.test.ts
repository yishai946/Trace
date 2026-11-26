import { ApiError, JoinedMission, Mission, OwnParticipation, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assignments, missions, participations, trackPoints } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('Finish Activity (UC-F15)', () => {
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
    });
    const assign = await commander({
      method: 'PUT',
      url: `/api/missions/${mission.id}/participants/${id}/assignment`,
      payload: { polygonId: (polygon.json() as { id: string }).id },
    });
    expect(assign.statusCode).toBe(200);
    await ctx.db.update(participations).set({ taskStatus: 'searching' }).where(eq(participations.id, id));
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

  const url = () => `/api/missions/${mission.id}/participation/finish-activity`;
  const send = (as: typeof user = user) => injectAs(ctx, as)({ method: 'POST', url: url() });
  const rowOf = async () => (await ctx.db.select().from(participations).where(eq(participations.id, id)))[0];
  const upload = () =>
    injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${mission.id}/track-points`,
      payload: { points: [{ position: [35.13, 31.78], recordedAt: '2026-10-03T13:05:00+03:00', context: 'search' }] },
    });

  it('ends the activity, closes the assignment, keeps the route and tells the commander', async () => {
    expect((await upload()).statusCode).toBe(200);
    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(OwnParticipation.parse(res.json())).toMatchObject({
      id,
      status: 'ended',
      polygonId: null,
      taskStatus: null,
    });
    expect(await rowOf()).toMatchObject({ status: 'ended', polygonId: null, taskStatus: null });
    const open = await ctx.db.select().from(assignments).where(eq(assignments.participationId, id));
    expect(open.every((row) => row.endedAt !== null)).toBe(true);
    expect(await ctx.db.select().from(trackPoints)).toHaveLength(1);
    expect(published.filter((e) => e.type === 'participant.updated')).toMatchObject([
      { missionId: mission.id, participant: { id, status: 'ended' } },
    ]);
  });

  it('rejects GPS points sent after the activity ended', async () => {
    await send();
    const res = await upload();
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('PARTICIPATION_ENDED');
  });

  it('works for a searcher who was never assigned, or whose task is finished or paused', async () => {
    for (const [polygonId, taskStatus] of [
      [null, null],
      [null, 'finished'],
      [null, 'paused'],
    ] as const) {
      await ctx.db
        .update(participations)
        .set({ status: 'available', polygonId, taskStatus })
        .where(eq(participations.id, id));
      const res = await send();
      expect(res.statusCode).toBe(200);
      expect(OwnParticipation.parse(res.json()).status).toBe('ended');
    }
  });

  it('is safe to send again: the activity stays ended and announces nothing', async () => {
    await send();
    published.length = 0;
    const again = await send();
    expect(again.statusCode).toBe(200);
    expect(OwnParticipation.parse(again.json()).status).toBe('ended');
    expect(published).toEqual([]);
  });

  it('is allowed after the mission ended or paused, since tracking continues until Finish Activity (decision 65)', async () => {
    for (const status of ['paused', 'ended_located', 'ended_stopped'] as const) {
      await ctx.db
        .update(participations)
        .set({ status: 'assigned', taskStatus: 'searching' })
        .where(eq(participations.id, id));
      await ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));
      const res = await send();
      expect(res.statusCode, status).toBe(200);
      expect(OwnParticipation.parse(res.json()).status).toBe('ended');
    }
  });

  it('lets the searcher join the active mission again as available (decision 70)', async () => {
    await send();
    const rejoin = await injectAs(ctx, user)({ method: 'POST', url: `/api/join/${mission.joinCode}` });
    expect(rejoin.statusCode).toBe(201);
    expect(JoinedMission.parse(rejoin.json()).participation).toMatchObject({ id, status: 'available' });
  });

  it('is for searchers of the mission only', async () => {
    const outsider = injectAs(ctx, await signInSearcher(ctx));
    expect((await outsider({ method: 'POST', url: url() })).statusCode).toBe(404);
    expect((await commander({ method: 'POST', url: url() })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'POST', url: url() })).statusCode).toBe(401);
  });
});
