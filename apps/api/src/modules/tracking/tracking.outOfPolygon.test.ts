import {
  Mission,
  MissionPolygon,
  MessageList,
  TimelineEventList,
  type MissionEvent,
  type TimelineEvent,
  type TrackPointInput,
} from '@trace/schemas';
import type { Polygon } from 'geojson';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { participations } from '../../db/schema';
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

const AREA: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [35.13, 31.78],
      [35.1311, 31.78],
      [35.1311, 31.7803],
      [35.13, 31.7803],
      [35.13, 31.78],
    ],
  ],
};

const INSIDE: [number, number] = [35.1305, 31.7801];
const FAR_OUTSIDE: [number, number] = [35.1305, 31.79];
/** About 5.5 m north of the boundary. */
const NEAR_BORDER: [number, number] = [35.1305, 31.78035];

let clock = Date.parse('2026-10-03T13:00:00Z');
const fix = (position: [number, number], context: 'search' | 'safety' = 'search'): TrackPointInput => {
  clock += 10_000;
  return { position, recordedAt: new Date(clock).toISOString(), context };
};

interface Setup {
  ctx: TestContext;
  commander: ReturnType<typeof injectAs>;
  missionId: string;
  polygonId: string;
  searcher: TestUser & { searcherId: string };
  participantId: string;
}

async function setup(ctx: TestContext, taskStatus?: 'searching' | 'paused' | 'ready'): Promise<Setup> {
  await resetDb(ctx.db);
  const commander = injectAs(ctx, await signInCommander(ctx));
  const mission = await commander({
    method: 'POST',
    url: '/api/missions',
    payload: {
      name: 'מסע',
      rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
      lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
    },
  });
  const missionId = Mission.parse(mission.json()).id;
  const polygon = await commander({
    method: 'POST',
    url: `/api/missions/${missionId}/polygons`,
    payload: { name: 'גזרה א', geometry: AREA },
  });
  const polygonId = MissionPolygon.parse(polygon.json()).id;
  const searcher = await signInSearcher(ctx);
  const participantId = await addParticipant(ctx.db, {
    missionId,
    callsign: 4,
    searcherId: searcher.searcherId,
    polygonId,
    ...(taskStatus ? { taskStatus } : {}),
  });
  return { ctx, commander, missionId, polygonId, searcher, participantId };
}

const upload = (s: Setup, ...points: TrackPointInput[]) =>
  injectAs(s.ctx, s.searcher)({
    method: 'POST',
    url: `/api/missions/${s.missionId}/track-points`,
    payload: { points },
  });

const alerts = async (s: Setup): Promise<TimelineEvent[]> => {
  const res = await s.commander({ method: 'GET', url: `/api/missions/${s.missionId}/timeline` });
  return TimelineEventList.parse(res.json()).filter(
    (e) => e.type === 'searcher.left_polygon' || e.type === 'searcher.returned_to_polygon',
  );
};
const types = async (s: Setup) => (await alerts(s)).map((e) => e.type);

const sentMessages = async (s: Setup) => {
  const res = await s.commander({ method: 'GET', url: `/api/missions/${s.missionId}/messages` });
  return MessageList.parse(res.json());
};

describe('Out-of-polygon alert (UC-S04, decision 14)', () => {
  let ctx: TestContext;
  let s: Setup;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());
  beforeEach(async () => {
    s = await setup(ctx);
  });

  it('records one system alert on the searcher and tells the commander at once when they leave the polygon', async () => {
    const events: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event, options) => {
      events.push(event);
      publish(event, options);
    };
    await upload(s, fix(FAR_OUTSIDE));
    ctx.realtime.publish = publish;

    const recorded = await alerts(s);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      type: 'searcher.left_polygon',
      actor: { kind: 'system' },
      subject: { kind: 'participant', id: s.participantId, callsign: 4 },
      details: { polygonId: s.polygonId, polygonName: 'גזרה א' },
    });
    expect(events.find((e) => e.type === 'timeline.recorded')).toMatchObject({
      missionId: s.missionId,
      event: { type: 'searcher.left_polygon' },
    });
  });

  it('alerts the searcher with an important message', async () => {
    await upload(s, fix(FAR_OUTSIDE));

    const messages = await sentMessages(s);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ urgency: 'important', target: { kind: 'searcher', participantId: s.participantId } });
    expect(messages[0]?.body).toContain('גזרה א');
  });

  it('records the distance outside, rounded', async () => {
    await upload(s, fix(FAR_OUTSIDE));

    const [left] = await alerts(s);
    expect(left?.type === 'searcher.left_polygon' && left.details.meters).toBeGreaterThan(1000);
  });

  it('raises nothing while the searcher is inside the polygon', async () => {
    await upload(s, fix(INSIDE), fix(INSIDE));

    expect(await alerts(s)).toEqual([]);
    expect(await sentMessages(s)).toEqual([]);
  });

  it('does not repeat while the searcher stays outside', async () => {
    await upload(s, fix(FAR_OUTSIDE));
    await upload(s, fix(FAR_OUTSIDE), fix(FAR_OUTSIDE));
    await upload(s, fix(FAR_OUTSIDE));

    expect(await types(s)).toEqual(['searcher.left_polygon']);
    expect(await sentMessages(s)).toHaveLength(1);
  });

  it('records the return, and alerts again when the searcher leaves a second time', async () => {
    await upload(s, fix(FAR_OUTSIDE));
    await upload(s, fix(INSIDE));
    await upload(s, fix(FAR_OUTSIDE));

    expect(await types(s)).toEqual(['searcher.left_polygon', 'searcher.returned_to_polygon', 'searcher.left_polygon']);
    expect(await sentMessages(s)).toHaveLength(2);
  });

  it('judges a batch by its newest point', async () => {
    await upload(s, fix(FAR_OUTSIDE), fix(INSIDE));

    expect(await alerts(s)).toEqual([]);
  });

  it('does not alert for a batch older than the last position', async () => {
    await upload(s, fix(INSIDE));
    const late = fix(FAR_OUTSIDE);
    await upload(s, fix(INSIDE));
    await upload(s, { ...late, recordedAt: '2026-10-03T12:00:00.000Z' });

    expect(await alerts(s)).toEqual([]);
  });

  it('raises nothing for a searcher with no polygon', async () => {
    const free = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: s.missionId, callsign: 5, searcherId: free.searcherId });
    await injectAs(ctx, free)({
      method: 'POST',
      url: `/api/missions/${s.missionId}/track-points`,
      payload: { points: [fix(FAR_OUTSIDE, 'safety')] },
    });

    expect(await alerts(s)).toEqual([]);
  });

  it('is judged against the polygon the searcher is assigned to now', async () => {
    await upload(s, fix(FAR_OUTSIDE));
    const other = await s.commander({
      method: 'POST',
      url: `/api/missions/${s.missionId}/polygons`,
      payload: {
        name: 'גזרה ב',
        geometry: { ...AREA, coordinates: [AREA.coordinates[0]?.map(([lng, lat]) => [lng ?? 0, (lat ?? 0) + 0.0099]) ?? []] },
      },
    });
    const otherId = MissionPolygon.parse(other.json()).id;
    await ctx.db.update(participations).set({ polygonId: otherId }).where(eq(participations.id, s.participantId));
    await upload(s, fix(INSIDE));

    expect(await types(s)).toEqual(['searcher.left_polygon', 'searcher.left_polygon']);
  });
});

describe('Out-of-polygon alert for a searcher who is not Searching', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it.each(['paused', 'ready'] as const)('raises nothing while the task is %s', async (taskStatus) => {
    const s = await setup(ctx, taskStatus);
    await upload(s, fix(FAR_OUTSIDE, 'safety'));

    expect(await alerts(s)).toEqual([]);
  });
});

describe('Out-of-polygon GPS tolerance (OUT_OF_POLYGON_TOLERANCE_METERS)', () => {
  let ctx: TestContext;
  afterAll(() => ctx.close());

  it('treats the boundary exactly when no tolerance is configured', async () => {
    ctx = await createTestApp();
    const s = await setup(ctx);
    await upload(s, fix(NEAR_BORDER));

    expect(await types(s)).toEqual(['searcher.left_polygon']);
  });

  it('forgives a position within the configured tolerance, and alerts past it', async () => {
    await ctx.close();
    ctx = await createTestApp({ OUT_OF_POLYGON_TOLERANCE_METERS: '10' });
    const s = await setup(ctx);
    await upload(s, fix(NEAR_BORDER));
    expect(await alerts(s)).toEqual([]);

    await upload(s, fix(FAR_OUTSIDE));
    expect(await types(s)).toEqual(['searcher.left_polygon']);
  });
});
