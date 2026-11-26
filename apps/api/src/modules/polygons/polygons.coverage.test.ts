import { Mission, MissionPolygon, MissionPolygonList, type MissionEvent, type TrackPointInput } from '@trace/schemas';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assignments } from '../../db/schema';
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

// About 95 m wide and 111 m tall: a 20 m strip along its width covers roughly a fifth of it.
const SQUARE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [35.13, 31.78],
      [35.131, 31.78],
      [35.131, 31.781],
      [35.13, 31.781],
      [35.13, 31.78],
    ],
  ],
};
const ASSIGNED_AT = new Date('2026-10-03T12:00:00Z');

/** Eight fixes five seconds apart, walking east along `lat` (about 2.4 m/s). */
const walk = (lat: number, overrides: Partial<TrackPointInput> = {}, startSecond = 0): TrackPointInput[] =>
  Array.from({ length: 8 }, (_, i) => ({
    position: [35.13 + i * 0.000125, lat],
    recordedAt: new Date(Date.parse('2026-10-03T13:00:00Z') + (startSecond + i * 5) * 1000).toISOString(),
    context: 'search',
    ...overrides,
  }));

describe('polygon Coverage (UC-S02)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let commanderId: string;
  let missionId: string;
  let polygonId: string;
  let searcher: TestUser & { searcherId: string };
  let participationId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    const commanderUser = await signInCommander(ctx);
    commanderId = commanderUser.userId;
    commander = injectAs(ctx, commanderUser);
    const mission = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    missionId = Mission.parse(mission.json()).id;
    const polygon = await commander({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { geometry: SQUARE },
    });
    polygonId = MissionPolygon.parse(polygon.json()).id;
    ({ searcher, participationId } = await assignedSearcher(4));
  });

  async function assignedSearcher(callsign: number, endedAt: Date | null = null) {
    const user = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId, callsign, searcherId: user.searcherId, polygonId });
    await ctx.db.insert(assignments).values({
      participationId: id,
      polygonId,
      assignedBy: commanderId,
      assignedAt: ASSIGNED_AT,
      endedAt,
    });
    return { searcher: user, participationId: id };
  }

  const upload = (points: TrackPointInput[], as: TestUser = searcher) =>
    injectAs(ctx, as)({ method: 'POST', url: `/api/missions/${missionId}/track-points`, payload: { points } });
  const coverage = async () => {
    const res = await commander({ method: 'GET', url: `/api/missions/${missionId}/polygons` });
    return MissionPolygonList.parse(res.json())[0]?.coverage;
  };
  const published = async (action: () => Promise<unknown>) => {
    const events: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      events.push(event);
      publish(event);
    };
    await action();
    ctx.realtime.publish = publish;
    return events;
  };

  it('is empty before anyone searched', async () => {
    expect(await coverage()).toBeNull();
  });

  it('grows with the Searching points inside the polygon and tells the commander at once', async () => {
    const events = await published(() => upload(walk(31.7805)));

    const percent = await coverage();
    expect(percent).toBeGreaterThanOrEqual(10);
    expect(percent).toBeLessThanOrEqual(25);
    expect(events.find((e) => e.type === 'polygon.saved')).toMatchObject({
      missionId,
      polygon: { id: polygonId, coverage: percent },
    });
  });

  it('does not publish when a batch changes nothing', async () => {
    await upload(walk(31.7805));
    const events = await published(() => upload(walk(31.7805)));

    expect(events.some((e) => e.type === 'polygon.saved')).toBe(false);
  });

  it('adds the strips of every searcher in the polygon and counts overlap once', async () => {
    await upload(walk(31.7805));
    const alone = await coverage();
    const other = await assignedSearcher(5);
    await upload(walk(31.7805), other.searcher);
    expect(await coverage()).toBe(alone);

    await upload(walk(31.7803, {}, 600), other.searcher);
    expect(await coverage()).toBeGreaterThan(alone ?? 0);
  });

  it('ignores points from a pause or other travel (decision 71)', async () => {
    await upload(walk(31.7805, { context: 'safety' }));
    expect(await coverage()).toBeNull();
  });

  it('counts nothing outside the polygon (decision 72)', async () => {
    await upload(walk(31.79));
    expect(await coverage()).toBe(0);
  });

  it('counts only the points recorded while the searcher was assigned to the polygon (decision 39)', async () => {
    const { searcher: moved } = await assignedSearcher(6, new Date('2026-10-03T12:30:00Z'));
    await upload(walk(31.7805), moved);
    expect(await coverage()).toBeNull();
  });

  it('counts a late batch that arrives after newer points', async () => {
    await upload(walk(31.7805, {}, 600));
    const first = await coverage();
    await upload(walk(31.7803));
    expect(await coverage()).toBeGreaterThan(first ?? 0);
    expect(participationId).toBeTruthy();
  });

  it('is recomputed against the new boundary when the commander reshapes the polygon', async () => {
    await upload(walk(31.7805));
    const before = await coverage();
    const smaller: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [35.13, 31.7803],
          [35.131, 31.7803],
          [35.131, 31.7807],
          [35.13, 31.7807],
          [35.13, 31.7803],
        ],
      ],
    };
    const res = await commander({
      method: 'PATCH',
      url: `/api/missions/${missionId}/polygons/${polygonId}`,
      payload: { geometry: smaller, confirmSearchersOutside: true },
    });

    expect(res.statusCode).toBe(200);
    expect(MissionPolygon.parse(res.json()).coverage).toBeGreaterThan(before ?? 0);
    expect(await coverage()).toBeGreaterThan(before ?? 0);
  });
});
