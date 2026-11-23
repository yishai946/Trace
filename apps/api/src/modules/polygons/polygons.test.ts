import {
  ApiError,
  Mission,
  MessageList,
  MissionPolygon,
  MissionPolygonList,
  SearcherOfflineDetails,
  SearchersOutsideDetails,
} from '@trace/schemas';
import type { Polygon } from 'geojson';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, polygons } from '../../db/schema';
import { addParticipant, createTestApp, injectAs, resetDb, signInCommander, type TestContext } from '../../testing';

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
  let ctx: TestContext;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    inject = injectAs(ctx, await signInCommander(ctx));
    const res = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    missionId = Mission.parse(res.json()).id;
  });

  const url = (polygonId?: string) => `/api/missions/${missionId}/polygons${polygonId ? `/${polygonId}` : ''}`;
  const create = async (geometry: Polygon = AREA, name?: string) => {
    const res = await inject({ method: 'POST', url: url(), payload: { geometry, name } });
    expect(res.statusCode).toBe(201);
    return MissionPolygon.parse(res.json());
  };
  const patch = (polygonId: string, payload: object) => inject({ method: 'PATCH', url: url(polygonId), payload });
  const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

  describe('create', () => {
    it('starts unassigned with no coverage, named "פוליגון N" unless given a name', async () => {
      const a = await create(AREA, 'ואדי צפוני');
      const b = await create(AREA);
      expect(a).toMatchObject({ name: 'ואדי צפוני', status: 'unassigned', coverage: null, activeSearchers: 0 });
      expect(a.geometry).toEqual(AREA);
      // Overlapping polygons are allowed (decision 38).
      expect(b.name).toBe('פוליגון 1');
    });

    it('never reuses the default name of a deleted polygon', async () => {
      const a = await create();
      await inject({ method: 'DELETE', url: url(a.id) });
      expect((await create()).name).toBe('פוליגון 2');
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
      const res = await inject({ method: 'POST', url: url(), payload: { geometry: bowtie } });
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
      const res = await inject({
        method: 'POST',
        url: url(),
        payload: { geometry: { type: 'Polygon', coordinates: [outer, farHole] } },
      });
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('INVALID_GEOMETRY');
    });

    it('rejects an open ring', async () => {
      const open = { type: 'Polygon', coordinates: [AREA.coordinates[0]?.slice(0, 4)] };
      const res = await inject({ method: 'POST', url: url(), payload: { geometry: open } });
      expect(res.statusCode).toBe(400);
    });

    it('is blocked unless the mission is active', async () => {
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      const res = await inject({ method: 'POST', url: url(), payload: { geometry: AREA } });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_NOT_ACTIVE');
    });

    it('returns 404 for an unknown mission', async () => {
      const res = await inject({
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
      await inject({ method: 'DELETE', url: url(c.id) });

      const list = MissionPolygonList.parse((await inject({ method: 'GET', url: url() })).json());
      expect(list.map((p) => [p.name, p.activeSearchers])).toEqual([
        ['פוליגון 1', 1],
        ['פוליגון 2', 0],
      ]);
      expect(list[1]?.id).toBe(b.id);
    });
  });

  describe('update', () => {
    it('renames a polygon and refuses a blank name', async () => {
      const a = await create();
      expect(MissionPolygon.parse((await patch(a.id, { name: 'חורשה' })).json()).name).toBe('חורשה');
      expect((await patch(a.id, { name: '  ' })).statusCode).toBe(400);
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

    describe('alert and Offline block (decisions 35, 86)', () => {
      const staleUpdate = () => new Date(Date.now() - 10 * 60_000);
      const makeOffline = (participationId: string) =>
        ctx.db
          .update(participations)
          .set({ lastPositionAt: staleUpdate() })
          .where(eq(participations.id, participationId));
      const sentMessages = async () => {
        const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/messages` });
        expect(res.statusCode).toBe(200);
        return MessageList.parse(res.json());
      };

      it('alerts only the searchers the boundary leaves outside, after the commander confirmed', async () => {
        const a = await create();
        const outsideId = await addParticipant(ctx.db, {
          missionId,
          callsign: 4,
          polygonId: a.id,
          position: INSIDE_ONLY_AREA,
        });
        await addParticipant(ctx.db, { missionId, callsign: 5, polygonId: a.id, position: [35.124, 31.772] });
        await addParticipant(ctx.db, { missionId, callsign: 6, position: INSIDE_ONLY_AREA });

        expect((await patch(a.id, { geometry: SMALLER })).statusCode).toBe(409);
        expect(await sentMessages()).toHaveLength(0);

        expect((await patch(a.id, { geometry: SMALLER, confirmSearchersOutside: true })).statusCode).toBe(200);
        const messages = await sentMessages();
        expect(messages).toHaveLength(1);
        expect(messages[0]?.urgency).toBe('important');
        expect(messages[0]?.recipients.map((recipient) => recipient.participantId)).toEqual([outsideId]);
      });

      it('sends no alert when nobody ends up outside, or when only the name changes', async () => {
        const a = await create();
        await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id, position: [35.124, 31.772] });
        await patch(a.id, { geometry: SMALLER });
        await patch(a.id, { name: 'חורשה' });
        expect(await sentMessages()).toHaveLength(0);
      });

      it('blocks a boundary that leaves an Offline searcher outside, and saves nothing', async () => {
        const a = await create();
        const offlineId = await addParticipant(ctx.db, {
          missionId,
          callsign: 4,
          polygonId: a.id,
          position: INSIDE_ONLY_AREA,
        });
        await makeOffline(offlineId);

        // Confirming the warning does not lift the block.
        for (const confirmSearchersOutside of [false, true]) {
          const res = await patch(a.id, { geometry: SMALLER, confirmSearchersOutside });
          expect(res.statusCode).toBe(409);
          const error = ApiError.parse(res.json()).error;
          expect(error.code).toBe('SEARCHER_OFFLINE');
          expect(SearcherOfflineDetails.parse(error.details).searchers).toEqual([
            { participantId: offlineId, callsign: 4, name: 'מחפש 4' },
          ]);
        }
        const [stored] = await ctx.db.select({ updatedAt: polygons.updatedAt }).from(polygons);
        expect(stored?.updatedAt.toISOString()).toBe(a.updatedAt);
        expect(await sentMessages()).toHaveLength(0);
      });

      it('lets a boundary change through when the Offline searcher is in another polygon or stays inside', async () => {
        const a = await create();
        const b = await create(box(35.2, 31.8, 35.21, 31.81));
        const elsewhere = await addParticipant(ctx.db, {
          missionId,
          callsign: 4,
          polygonId: b.id,
          position: INSIDE_ONLY_AREA,
        });
        const inside = await addParticipant(ctx.db, {
          missionId,
          callsign: 5,
          polygonId: a.id,
          position: [35.124, 31.772],
        });
        await makeOffline(elsewhere);
        await makeOffline(inside);
        expect((await patch(a.id, { geometry: SMALLER })).statusCode).toBe(200);
      });

      it('does not block a searcher who is online by their last update', async () => {
        const a = await create();
        await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id, position: INSIDE_ONLY_AREA });
        const res = await patch(a.id, { geometry: SMALLER, confirmSearchersOutside: true });
        expect(res.statusCode).toBe(200);
      });
    });

    it('returns 404 for a deleted polygon', async () => {
      const a = await create();
      await inject({ method: 'DELETE', url: url(a.id) });
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
      const res = await inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(204);
      const [row] = await ctx.db.select({ deletedAt: polygons.deletedAt }).from(polygons).where(eq(polygons.id, a.id));
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it('is blocked while a searcher is assigned (decision 36)', async () => {
      const a = await create();
      await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
      const res = await inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('POLYGON_HAS_ACTIVE_SEARCHERS');
    });

    it('is blocked once the mission has ended', async () => {
      const a = await create();
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));
      const res = await inject({ method: 'DELETE', url: url(a.id) });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_NOT_ACTIVE');
    });
  });
});
