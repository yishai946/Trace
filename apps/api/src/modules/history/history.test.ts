import { ApiError, OwnActivity } from '@trace/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, reports, sightings } from '../../db/schema';
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

const ID_1 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a01';
const ID_2 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a02';
const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

describe('GET /missions/:id/my-activity', () => {
  let ctx: TestContext;
  let commander: TestUser;
  let me: TestUser & { searcherId: string };
  let other: TestUser & { searcherId: string };
  let missionId: string;
  let polygonId: string;

  const get = (as: TestUser, id = missionId) =>
    injectAs(ctx, as)({ method: 'GET', url: `/api/missions/${id}/my-activity` });
  const end = () => ctx.db.update(missions).set({ status: 'ended_stopped', endedAt: new Date() });
  const addReport = (id: string, by: TestUser, text: string) =>
    ctx.db.insert(reports).values({
      id,
      missionId,
      reportedBy: by.userId,
      type: 'hazard',
      text,
      position: { type: 'Point', coordinates: [35.1, 31.7] },
      reportedAt: new Date('2026-10-03T10:00:00Z'),
    });
  const addSighting = (by: TestUser, description: string) =>
    ctx.db.insert(sightings).values({
      missionId,
      reportedBy: by.userId,
      source: 'self',
      position: { type: 'Point', coordinates: [35.1, 31.7] },
      observedAt: new Date('2026-10-03T10:00:00Z'),
      description,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    const inject = injectAs(ctx, commander);
    const created = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    missionId = created.json().id;
    const area = [
      [35.122, 31.77],
      [35.136, 31.77],
      [35.136, 31.781],
      [35.122, 31.781],
      [35.122, 31.77],
    ];
    const poly = await inject({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { name: 'A', geometry: { type: 'Polygon', coordinates: [area] } },
    });
    polygonId = poly.json().id;
    me = await signInSearcher(ctx);
    other = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 4, searcherId: me.searcherId, polygonId });
    await addParticipant(ctx.db, { missionId, callsign: 5, searcherId: other.searcherId, polygonId });
  });
  afterAll(() => ctx.close());

  it('returns only my own participation, reports and sightings, not another searcher’s', async () => {
    await addReport(ID_1, me, 'שלי');
    await addReport(ID_2, other, 'של אחר');
    await addSighting(other, 'של אחר');
    await addSighting(me, 'שלי');
    await end();

    const res = await get(me);
    expect(res.statusCode).toBe(200);
    const activity = OwnActivity.parse(res.json());
    expect(activity).toMatchObject({ callsign: 4, status: 'assigned', polygon: { id: polygonId } });
    expect(activity.reports.map((r) => r.text)).toEqual(['שלי']);
    expect(activity.sightings.map((s) => [s.description, s.number])).toEqual([['שלי', 2]]);
  });

  it('returns empty lists for a searcher who reported nothing', async () => {
    await end();
    const activity = OwnActivity.parse((await get(me)).json());
    expect(activity.reports).toEqual([]);
    expect(activity.sightings).toEqual([]);
  });

  it('has no polygon for a searcher who was never assigned', async () => {
    const lone = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId, callsign: 9, searcherId: lone.searcherId });
    await end();
    expect(OwnActivity.parse((await get(lone)).json()).polygon).toBeNull();
  });

  it('answers 404 while the mission has not ended', async () => {
    const res = await get(me);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe('NOT_FOUND');
  });

  it('answers 404 for a mission the searcher never joined', async () => {
    await end();
    const outsider = await signInSearcher(ctx);
    expect((await get(outsider)).statusCode).toBe(404);
    expect((await get(me, '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a99')).statusCode).toBe(404);
  });

  it('is for searchers only and needs sign-in', async () => {
    await end();
    expect((await get(commander)).statusCode).toBe(403);
    const anonymous = await ctx.app.inject({ method: 'GET', url: `/api/missions/${missionId}/my-activity` });
    expect(anonymous.statusCode).toBe(401);
  });
});
