import { ApiError, Mission, MissionPolygon, MissionPolygonList, SearchersOutsideDetails } from '@trace/schemas';
import type { Polygon } from 'geojson';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, polygons } from '../../db/schema';
import { addParticipant, createTestApp, resetDb } from '../../testing';

const box = (west: number, south: number, east: number, north: number): Polygon => ({
  type: 'Polygon',
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

const AREA = box(35.122, 31.77, 35.136, 31.781);
const SMALLER = box(35.122, 31.77, 35.126, 31.774);
const INSIDE_ONLY_AREA: [number, number] = [35.13, 31.778];

describe('polygons', () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/missions',
      payload: { name: 'מסע', rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] } },
    });
    missionId = Mission.parse(res.json()).id;
  });

  const url = (polygonId?: string) => `/api/missions/${missionId}/polygons${polygonId ? `/${polygonId}` : ''}`;
  const create = async (geometry: Polygon = AREA, name?: string) => {
    const res = await ctx.app.inject({ method: 'POST', url: url(), payload: { geometry, name } });
    expect(res.statusCode).toBe(201);
    return MissionPolygon.parse(res.json());
  };
  const patch = (polygonId: string, payload: object) =>
    ctx.app.inject({ method: 'PATCH', url: url(polygonId), payload });
  const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

  describe('create', () => {
    it('starts unassigned, with the next letter and no coverage', async () => {
      const a = await create(AREA, 'ואדי צפוני');
      const b = await create(AREA);
      expect(a).toMatchObject({
        letter: 'A',
        name: 'ואדי צפוני',
        status: 'unassigned',
        coverage: null,
        activeSearchers: 0,
      });
      expect(a.geometry).toEqual(AREA);
      // Overlapping polygons are allowed (decision 38).
      expect(b.letter).toBe('B');
    });

    it('never reuses the letter of a deleted polygon', async () => {
      const a = await create();
      await ctx.app.inject({ method: 'DELETE', url: url(a.id) });
      expect((await create()).letter).toBe('B');
    });

    it('rejects a boundary that crosses itself', async () => {
      const bowtie: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [35.12, 31.77],
            [35.13, 31.78],
            [35.13, 31.77],
            [35.12, 31.78],
            [35.12, 31.77],
          ],
        ],
      };
      const res = await ctx.app.inject({ method: 'POST', url: url(), payload: { geometry: bowtie } });
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('INVALID_GEOMETRY');
    });

    it('rejects a hole outside the outer ring', async () => {
      const outer = AREA.coordinates[0] ?? [];
      const farHole = [
        [35.2, 31.9],
        [35.21, 31.9],
        [35.21, 31.91],
        [35.2, 31.9],
      ];
      const res = await ctx.app.inject({
        method: 'POST',
        url: url(),
        payload: { geometry: { type: 'Polygon', coordinates: [outer, farHole] } },
      });
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('INVALID_GEOMETRY');
    });

    it('rejects an open ring', async () => {
      const open = { type: 'Polygon', coordinates: [AREA.coordinates[0]?.slice(0, 4)] };
      const res = await ctx.app.inject({ method: 'POST', url: url(), payload: { geometry: open } });
      expect(res.statusCode).toBe(400);
    });

    it('is blocked unless the mission is active', async () => {
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      const res = await ctx.app.inject({ method: 'POST', url: url(), payload: { geometry: AREA } });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_NOT_ACTIVE');
    });

    it('returns 404 for an unknown mission', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/missions/00000000-0000-4000-8000-000000000000/polygons',
        payload: { geometry: AREA },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('list', () => {
    it('lists polygons in creation order with their active searchers, without deleted ones', async () => {
      const a = await create();
      const b = await create();
      const c = await create();
      await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id, position: INSIDE_ONLY_AREA });
      await addParticipant(ctx.db, { missionId, callsign: 9 });
      await ctx.app.inject({ method: 'DELETE', url: url(c.id) });

      const list = MissionPolygonList.parse((await ctx.app.inject({ method: 'GET', url: url() })).json());
      expect(list.map((p) => [p.letter, p.activeSearchers])).toEqual([
        ['A', 1],
        ['B', 0],
      ]);
      expect(list[1]?.id).toBe(b.id);
    });
  });

  describe('update', () => {
    it('renames a polygon and clears the name', async () => {
      const a = await create();
      expect(MissionPolygon.parse((await patch(a.id, { name: 'חורשה' })).json()).name).toBe('חורשה');
      expect(MissionPolygon.parse((await patch(a.id, { name: '' })).json()).name).toBeNull();
    });

    it('changes the boundary when no assigned searcher ends up outside', async () => {
      const a = await create();
      await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id, position: [35.124, 31.772] });
      const res = await patch(a.id, { geometry: SMALLER });
      expect(res.statusCode).toBe(200);
      expect(MissionPolygon.parse(res.json()).geometry).toEqual(SMALLER);
    });

    it('warns with the searchers left outside, then saves after confirmation (UC-C06)', async () => {
      const a = await create();
      const outsideId = await addParticipant(ctx.db, {
        missionId,
        callsign: 4,
        polygonId: a.id,
        position: INSIDE_ONLY_AREA,
      });
      // Searchers without a position, or not assigned to this polygon, are not part of the warning.
      await addParticipant(ctx.db, { missionId, callsign: 5, polygonId: a.id });
      await addParticipant(ctx.db, { missionId, callsign: 6, position: INSIDE_ONLY_AREA });

      const warned = await patch(a.id, { geometry: SMALLER });
      expect(warned.statusCode).toBe(409);
      const error = ApiError.parse(warned.json()).error;
      expect(error.code).toBe('SEARCHERS_OUTSIDE_POLYGON');
      const { searchers } = SearchersOutsideDetails.parse(error.details);
      expect(searchers).toHaveLength(1);
      expect(searchers[0]).toMatchObject({ participantId: outsideId, callsign: 4, name: 'מחפש 4' });
      expect(searchers[0]?.meters).toBeGreaterThan(300);

      // Nothing was saved yet.
      const [stored] = await ctx.db.select({ updatedAt: polygons.updatedAt }).from(polygons);
      expect(stored?.updatedAt.toISOString()).toBe(a.updatedAt);

      const confirmed = await patch(a.id, { geometry: SMALLER, confirmSearchersOutside: true });
      expect(confirmed.statusCode).toBe(200);
      expect(MissionPolygon.parse(confirmed.json()).geometry).toEqual(SMALLER);
    });

    it('returns 404 for a deleted polygon', async () => {
      const a = await create();
      await ctx.app.inject({ method: 'DELETE', url: url(a.id) });
      expect((await patch(a.id, { name: 'x' })).statusCode).toBe(404);
    });

    it('rejects an empty update', async () => {
      const a = await create();
      expect((await patch(a.id, {})).statusCode).toBe(400);
    });
  });

  describe('delete', () => {
    it('removes the polygon from the map but keeps the row for history', async () => {
      const a = await create();
      const res = await ctx.app.inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(204);
      const [row] = await ctx.db.select({ deletedAt: polygons.deletedAt }).from(polygons).where(eq(polygons.id, a.id));
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it('is blocked while a searcher is assigned (decision 36)', async () => {
      const a = await create();
      await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
      const res = await ctx.app.inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('POLYGON_HAS_ACTIVE_SEARCHERS');
    });

    it('is blocked once the mission has ended', async () => {
      const a = await create();
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));
      const res = await ctx.app.inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_NOT_ACTIVE');
    });
  });
});
