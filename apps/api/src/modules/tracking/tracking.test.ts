import { Mission, ParticipantList, TrackPointsResult, type MissionEvent, type TrackPointInput } from '@trace/schemas';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asGeoJson } from '../../db/geometry';
import { trackPoints } from '../../db/schema';
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
    ]);
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
});
