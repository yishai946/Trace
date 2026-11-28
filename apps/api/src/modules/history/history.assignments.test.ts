import { ApiError, AssignmentRecordList, Mission } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

const square = (lng: number) => ({
  type: 'Polygon',
  coordinates: [
    [
      [lng, 31.77],
      [lng + 0.01, 31.77],
      [lng + 0.01, 31.78],
      [lng, 31.77],
    ],
  ],
});

describe('GET /missions/:id/assignments (UC-C20)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let missionId: string;
  let polygonA: string;
  let polygonB: string;
  let participantId: string;

  const get = (as = commander, id = missionId) => as({ method: 'GET', url: `/api/missions/${id}/assignments` });
  const assign = (polygonId: string) =>
    commander({
      method: 'PUT',
      url: `/api/missions/${missionId}/participants/${participantId}/assignment`,
      payload: { polygonId },
    });
  const createPolygon = async (name: string, lng: number) =>
    (
      (
        await commander({
          method: 'POST',
          url: `/api/missions/${missionId}/polygons`,
          payload: { name, geometry: square(lng) },
        })
      ).json() as { id: string }
    ).id;

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
    missionId = Mission.parse(res.json()).id;
    polygonA = await createPolygon('A', 35.12);
    polygonB = await createPolygon('B', 35.14);
    participantId = await addParticipant(ctx.db, { missionId, callsign: 7 });
  });
  afterAll(() => ctx.close());

  it('is empty before anyone was assigned', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(AssignmentRecordList.parse(res.json())).toEqual([]);
  });

  it('lists every assignment oldest first, the moved one closed and the current one open', async () => {
    await assign(polygonA);
    await assign(polygonB);
    const list = AssignmentRecordList.parse((await get()).json());
    expect(list.map((a) => [a.polygonName, a.callsign, a.participantId, a.endedAt === null])).toEqual([
      ['A', 7, participantId, false],
      ['B', 7, participantId, true],
    ]);
    expect(list[0]?.name).toBe('מחפש 7');
  });

  it('stays readable after the mission ended', async () => {
    await assign(polygonA);
    await ctx.db.update(missions).set({ status: 'ended_stopped', endedAt: new Date() });
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(AssignmentRecordList.parse(res.json())).toHaveLength(1);
  });

  it('is for the mission commander only', async () => {
    const searcher = await signInSearcher(ctx);
    expect((await get(injectAs(ctx, searcher))).statusCode).toBeGreaterThanOrEqual(403);
    const other = injectAs(ctx, await signInCommander(ctx));
    const res = await get(other);
    expect(res.statusCode).toBeGreaterThanOrEqual(403);
    expect(ApiError.safeParse(res.json()).success).toBe(true);
  });
});
