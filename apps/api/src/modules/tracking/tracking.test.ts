import {
  Mission,
  ParticipantList,
  ParticipantTrack,
  TrackPointsResult,
  type MissionEvent,
  type TrackPointInput,
} from '@trace/schemas';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asGeoJson } from '../../db/geometry';
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

const point = (minute: number, overrides: Partial<TrackPointInput> = {}): TrackPointInput => ({
  position: [35.13 + minute / 1000, 31.78],
  recordedAt: `2026-10-03T13:${String(minute).padStart(2, '0')}:00+03:00`,
  context: 'search',
  ...overrides,
});

describe('track points (UC-S01)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let user: TestUser & { searcherId: string };
  let participationId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = injectAs(ctx, await signInCommander(ctx));
    const res = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    mission = Mission.parse(res.json());
    user = await signInSearcher(ctx);
    participationId = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: user.searcherId });
  });
  afterAll(() => ctx.close());

  const upload = (points: TrackPointInput[], as: TestUser = user) =>
    injectAs(ctx, as)({ method: 'POST', url: `/api/missions/${mission.id}/track-points`, payload: { points } });
  const saved = () =>
    ctx.db
      .select({
        recordedAt: trackPoints.recordedAt,
        context: trackPoints.context,
        position: asGeoJson(trackPoints.position),
      })
      .from(trackPoints)
      .where(eq(trackPoints.participationId, participationId))
      .orderBy(asc(trackPoints.recordedAt));
  const lastPosition = async () =>
    ParticipantList.parse(
      (await commander({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json(),
    )[0];

  it('saves a batch with its context and moves the last position to the newest point', async () => {
    const published: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      published.push(event);
      publish(event);
    };
    const res = await upload([point(2), point(1, { context: 'safety' }), point(3, { accuracy: 8 })]);
    ctx.realtime.publish = publish;

    expect(res.statusCode).toBe(200);
    expect(TrackPointsResult.parse(res.json())).toEqual({ stored: 3, duplicates: 0 });
    expect((await saved()).map((p) => p.context)).toEqual(['safety', 'search', 'search']);
    expect(await lastPosition()).toMatchObject({
      position: [35.133, 31.78],
      positionAt: new Date('2026-10-03T13:03:00+03:00').toISOString(),
    });
    expect(published).toMatchObject([
      {
        type: 'participant.moved',
        participantId: participationId,
        searcherId: user.searcherId,
        position: [35.133, 31.78],
      },
      { type: 'participant.tracked', participantId: participationId },
    ]);
    expect(published[1]).toMatchObject({ points: [{ context: 'safety' }, { context: 'search' }, { accuracy: 8 }] });
  });

  it('adds nothing when the same batch arrives again', async () => {
    await upload([point(1), point(2)]);
    const again = await upload([point(1), point(2), point(3)]);

    expect(TrackPointsResult.parse(again.json())).toEqual({ stored: 1, duplicates: 2 });
    expect(await saved()).toHaveLength(3);
  });

  it('keeps a newer last position when an older offline batch arrives later', async () => {
    await upload([point(10)]);
    await upload([point(1), point(2)]);

    expect((await lastPosition())?.position).toEqual([35.14, 31.78]);
    expect(await saved()).toHaveLength(3);
  });

  it('counts one point for the same instant, in one batch or written with another time offset', async () => {
    const res = await upload([point(1), point(1), { ...point(1), recordedAt: '2026-10-03T10:01:00Z' }]);
    expect(TrackPointsResult.parse(res.json())).toEqual({ stored: 1, duplicates: 2 });
  });

  it('keeps a point dated in the future, but does not let it move the last position', async () => {
    await upload([point(1)]);
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await upload([{ ...point(5), recordedAt: future }]);

    expect(await saved()).toHaveLength(2);
    expect((await lastPosition())?.position).toEqual([35.131, 31.78]);
  });

  it('refuses points once the activity ended', async () => {
    const ended = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 5, searcherId: ended.searcherId, status: 'ended' });
    const res = await upload([point(1)], ended);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'PARTICIPATION_ENDED' } });
  });

  it('refuses a searcher outside the mission and the commander', async () => {
    const outsider = await signInSearcher(ctx);
    expect((await upload([point(1)], outsider)).statusCode).toBe(404);
    const res = await commander({
      method: 'POST',
      url: `/api/missions/${mission.id}/track-points`,
      payload: { points: [point(1)] },
    });
    expect(res.statusCode).toBe(403);
    expect(await saved()).toHaveLength(0);
  });

  it('rejects an invalid point', async () => {
    const res = await upload([{ ...point(1), position: [200, 31.78] }]);
    expect(res.statusCode).toBe(400);
  });

  describe('the route (UC-C10)', () => {
    const trackUrl = (id: string = participationId, missionId: string = mission.id) =>
      `/api/missions/${missionId}/participants/${id}/track`;
    const route = (id?: string) => commander({ method: 'GET', url: trackUrl(id) });
    const at = (minute: number) => new Date(point(minute).recordedAt).toISOString();

    it('lists the points oldest first with their accuracy and context', async () => {
      await upload([point(3, { accuracy: 8 }), point(1, { context: 'safety' }), point(2)]);
      const res = await route();

      expect(res.statusCode).toBe(200);
      expect(ParticipantTrack.parse(res.json())).toEqual({
        participantId: participationId,
        points: [
          { position: [35.131, 31.78], recordedAt: at(1), accuracy: null, context: 'safety' },
          { position: [35.132, 31.78], recordedAt: at(2), accuracy: null, context: 'search' },
          { position: [35.133, 31.78], recordedAt: at(3), accuracy: 8, context: 'search' },
        ],
      });
    });

    it('is empty before the first point', async () => {
      expect(ParticipantTrack.parse((await route()).json()).points).toEqual([]);
    });

    it('stays readable after the activity ended and while the mission is not active', async () => {
      await upload([point(1)]);
      await ctx.db.update(participations).set({ status: 'ended' }).where(eq(participations.id, participationId));
      for (const status of ['paused', 'ended_located', 'ended_stopped'] as const) {
        await ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));
        const res = await route();
        expect(res.statusCode, status).toBe(200);
        expect(ParticipantTrack.parse(res.json()).points, status).toHaveLength(1);
      }
    });

    it('is the commander of the mission only', async () => {
      await upload([point(1)]);
      // A searcher of the mission, even for their own route, is refused (decision 32).
      expect((await injectAs(ctx, user)({ method: 'GET', url: trackUrl() })).statusCode).toBe(403);
      const other = await signInSearcher(ctx);
      const otherId = await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 5,
        searcherId: other.searcherId,
      });
      expect((await injectAs(ctx, user)({ method: 'GET', url: trackUrl(otherId) })).statusCode).toBe(403);
      // Not a searcher of the mission at all.
      const outsider = await signInSearcher(ctx);
      expect((await injectAs(ctx, outsider)({ method: 'GET', url: trackUrl() })).statusCode).toBe(404);
      // Another commander does not learn the mission exists.
      const stranger = injectAs(ctx, await signInCommander(ctx));
      expect((await stranger({ method: 'GET', url: trackUrl() })).statusCode).toBe(404);
      expect((await ctx.app.inject({ method: 'GET', url: trackUrl() })).statusCode).toBe(401);
    });

    it('does not give the route of a searcher of another mission through this one', async () => {
      const created = await commander({
        method: 'POST',
        url: '/api/missions',
        payload: {
          name: 'אחר',
          rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
          lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
        },
      });
      const otherMission = Mission.parse(created.json());
      const otherSearcher = await signInSearcher(ctx);
      const otherId = await addParticipant(ctx.db, {
        missionId: otherMission.id,
        callsign: 1,
        searcherId: otherSearcher.searcherId,
      });
      await injectAs(
        ctx,
        otherSearcher,
      )({
        method: 'POST',
        url: `/api/missions/${otherMission.id}/track-points`,
        payload: { points: [point(1)] },
      });

      expect((await route(otherId)).statusCode).toBe(404);
      expect((await commander({ method: 'GET', url: trackUrl(otherId, otherMission.id) })).statusCode).toBe(200);
    });
  });
});
