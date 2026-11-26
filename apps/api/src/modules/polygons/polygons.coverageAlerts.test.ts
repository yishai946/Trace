import {
  Mission,
  MissionPolygon,
  MissionPolygonList,
  TimelineEventList,
  type MissionEvent,
  type TimelineEvent,
  type TrackPointInput,
} from '@trace/schemas';
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

const rect = (south: number, north: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [35.13, south],
      [35.1311, south],
      [35.1311, north],
      [35.13, north],
      [35.13, south],
    ],
  ],
});

/** Twelve fixes five seconds apart along `lat`, walking east across the whole width (about 2 m/s). */
const row = (lat: number, startSecond: number): TrackPointInput[] =>
  Array.from({ length: 12 }, (_, i) => ({
    position: [35.13 + i * 0.0001, lat],
    recordedAt: new Date(Date.parse('2026-10-03T13:00:00Z') + (startSecond + i * 5) * 1000).toISOString(),
    context: 'search',
  }));

describe('Coverage threshold alerts (UC-S02, decision 55)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let missionId: string;
  let polygonId: string;
  let searcher: TestUser & { searcherId: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    const commanderUser = await signInCommander(ctx);
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
      payload: { name: 'גזרה א', geometry: rect(31.78, 31.7803) },
    });
    polygonId = MissionPolygon.parse(polygon.json()).id;
    searcher = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId, callsign: 4, searcherId: searcher.searcherId, polygonId });
    await ctx.db.insert(assignments).values({
      participationId: id,
      polygonId,
      assignedBy: commanderUser.userId,
      assignedAt: new Date('2026-10-03T12:00:00Z'),
    });
  });

  const upload = (points: TrackPointInput[]) =>
    injectAs(ctx, searcher)({ method: 'POST', url: `/api/missions/${missionId}/track-points`, payload: { points } });
  const coverage = async () => {
    const res = await commander({ method: 'GET', url: `/api/missions/${missionId}/polygons` });
    return MissionPolygonList.parse(res.json())[0]?.coverage;
  };
  const thresholds = async (): Promise<TimelineEvent[]> => {
    const res = await commander({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
    return TimelineEventList.parse(res.json()).filter((e) => e.type === 'coverage.threshold_reached');
  };

  /** Rows that bring this polygon to 43, 66, 89 and 100 percent, one upload each. */
  const ROWS = [31.78004, 31.78011, 31.78018, 31.78023];
  const walkRow = (index: number) => upload(row(ROWS[index] ?? 0, index * 600));
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
  const reshape = (geometry: Polygon) =>
    commander({
      method: 'PATCH',
      url: `/api/missions/${missionId}/polygons/${polygonId}`,
      payload: { geometry, confirmSearchersOutside: true },
    });

  it('raises nothing below 80 percent', async () => {
    await walkRow(0);
    await walkRow(1);

    expect(await coverage()).toBe(66);
    expect(await thresholds()).toEqual([]);
  });

  it('records one system alert on the polygon when Coverage crosses 80 and tells the commander at once', async () => {
    await walkRow(0);
    await walkRow(1);
    const events = await published(() => walkRow(2));

    const alerts = await thresholds();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'coverage.threshold_reached',
      actor: { kind: 'system' },
      subject: { kind: 'polygon', id: polygonId, label: 'גזרה א' },
      details: { threshold: 80 },
    });
    expect(events.find((e) => e.type === 'timeline.recorded')).toMatchObject({
      missionId,
      event: { type: 'coverage.threshold_reached', details: { threshold: 80 } },
    });
  });

  it('records 90 separately, and neither threshold again while the search goes on', async () => {
    await walkRow(0);
    await walkRow(1);
    await walkRow(2);
    await walkRow(3);
    await upload(row(31.78015, 2400));

    const alerts = await thresholds();
    expect(alerts.map((e) => e.details)).toEqual([{ threshold: 80 }, { threshold: 90 }]);
  });

  it('records both thresholds when one batch crosses both', async () => {
    await upload([...row(31.78004, 0), ...row(31.78011, 100), ...row(31.78018, 200), ...row(31.78023, 300)]);

    expect(await coverage()).toBe(100);
    expect((await thresholds()).map((e) => e.details)).toEqual([{ threshold: 80 }, { threshold: 90 }]);
  });

  it('records a threshold once even when Coverage falls below it and rises again (decision 55)', async () => {
    await walkRow(0);
    await walkRow(1);
    await walkRow(2);
    expect(await thresholds()).toHaveLength(1);

    expect((await reshape(rect(31.78, 31.7812))).statusCode).toBe(200);
    expect(await coverage()).toBeLessThan(80);
    expect((await reshape(rect(31.78, 31.7803))).statusCode).toBe(200);

    expect(await coverage()).toBeGreaterThanOrEqual(80);
    expect(await thresholds()).toHaveLength(1);
  });

  it('records the threshold a new boundary pushes Coverage over', async () => {
    await walkRow(0);
    await walkRow(1);
    expect(await thresholds()).toEqual([]);

    const events = await published(() => reshape(rect(31.78, 31.78024)));

    expect(await coverage()).toBeGreaterThanOrEqual(80);
    expect((await thresholds()).map((e) => e.details)).toEqual([{ threshold: 80 }]);
    expect(events.some((e) => e.type === 'timeline.recorded' && e.event.type === 'coverage.threshold_reached')).toBe(
      true,
    );
  });

  it('raises nothing when points are outside the polygon', async () => {
    await upload(row(31.79, 0));

    expect(await coverage()).toBe(0);
    expect(await thresholds()).toEqual([]);
  });
});
