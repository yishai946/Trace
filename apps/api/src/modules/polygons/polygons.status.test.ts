import {
  ActiveSearchersDetails,
  ApiError,
  Mission,
  MessageList,
  MissionPolygon,
  MissionPolygonList,
  TimelineEventList,
} from '@trace/schemas';
import type { Polygon } from 'geojson';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, polygons } from '../../db/schema';
import { addParticipant, createTestApp, injectAs, resetDb, signInCommander, type TestContext } from '../../testing';

const AREA: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [35.122, 31.77],
      [35.136, 31.77],
      [35.136, 31.781],
      [35.122, 31.781],
      [35.122, 31.77],
    ],
  ],
};

describe('polygon status (UC-C07)', () => {
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

  const url = (polygonId: string) => `/api/missions/${missionId}/polygons/${polygonId}/status`;
  const setStatus = (polygonId: string, payload: object) => inject({ method: 'PUT', url: url(polygonId), payload });
  const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;
  const create = async () => {
    const res = await inject({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { geometry: AREA, name: 'ואדי' },
    });
    return MissionPolygon.parse(res.json());
  };
  const messages = async () => {
    const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/messages` });
    return MessageList.parse(res.json());
  };
  const timeline = async () => {
    const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/timeline` });
    return TimelineEventList.parse(res.json()).filter(
      (e) => e.type.startsWith('polygon.') && e.type !== 'polygon.created',
    );
  };
  const taskOf = async (participationId: string) => {
    const [row] = await ctx.db
      .select({
        taskStatus: participations.taskStatus,
        status: participations.status,
        polygonId: participations.polygonId,
      })
      .from(participations)
      .where(eq(participations.id, participationId));
    return row;
  };

  it('completes a polygon with no searchers at any Coverage, including 0%', async () => {
    const a = await create();
    const res = await setStatus(a.id, { status: 'completed' });
    expect(res.statusCode).toBe(200);
    expect(MissionPolygon.parse(res.json())).toMatchObject({ status: 'completed', coverage: null });
    expect(await messages()).toHaveLength(0);
  });

  it('asks for confirmation when searchers are active, and changes nothing without it', async () => {
    const a = await create();
    const searcher = await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    const res = await setStatus(a.id, { status: 'completed' });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('POLYGON_SEARCHERS_ACTIVE');
    const details = ActiveSearchersDetails.parse(ApiError.parse(res.json()).error.details);
    expect(details.searchers.map((s) => s.participantId)).toEqual([searcher]);
    expect((await taskOf(searcher))?.taskStatus).toBe('searching');
    const [row] = await ctx.db.select({ status: polygons.status }).from(polygons).where(eq(polygons.id, a.id));
    expect(row?.status).not.toBe('completed');
  });

  it('on confirmation ends the searchers tasks, keeps them assigned and sends them a message', async () => {
    const a = await create();
    const searching = await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    const paused = await addParticipant(ctx.db, { missionId, callsign: 5, polygonId: a.id, taskStatus: 'paused' });
    const done = await addParticipant(ctx.db, { missionId, callsign: 6, polygonId: a.id, taskStatus: 'finished' });
    const other = await create();
    const elsewhere = await addParticipant(ctx.db, { missionId, callsign: 7, polygonId: other.id });

    const res = await setStatus(a.id, { status: 'completed', confirmActiveSearchers: true });
    expect(res.statusCode).toBe(200);
    expect(MissionPolygon.parse(res.json()).status).toBe('completed');
    for (const id of [searching, paused, done]) {
      expect(await taskOf(id)).toMatchObject({ taskStatus: 'finished', status: 'assigned', polygonId: a.id });
    }
    expect((await taskOf(elsewhere))?.taskStatus).toBe('searching');

    const sent = await messages();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.urgency).toBe('important');
    expect(sent[0]?.body).toContain('ואדי');
    expect(sent[0]?.recipients.map((r) => r.participantId).sort()).toEqual([searching, paused].sort());
  });

  it('does not ask for confirmation when every task already finished', async () => {
    const a = await create();
    await addParticipant(ctx.db, { missionId, callsign: 6, polygonId: a.id, taskStatus: 'finished' });
    expect((await setStatus(a.id, { status: 'completed' })).statusCode).toBe(200);
    expect(await messages()).toHaveLength(0);
  });

  it('returns Completed to Active and keeps Coverage and routes (decision 57)', async () => {
    const a = await create();
    await ctx.db.update(polygons).set({ coverage: 62 }).where(eq(polygons.id, a.id));
    await setStatus(a.id, { status: 'completed' });
    const res = await setStatus(a.id, { status: 'active' });
    expect(res.statusCode).toBe(200);
    expect(MissionPolygon.parse(res.json())).toMatchObject({ status: 'active', coverage: 62 });
  });

  it('is idempotent and announces nothing the second time', async () => {
    const a = await create();
    const searcher = await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    await setStatus(a.id, { status: 'completed', confirmActiveSearchers: true });
    const again = await setStatus(a.id, { status: 'completed' });
    expect(again.statusCode).toBe(200);
    expect(await messages()).toHaveLength(1);
    expect((await taskOf(searcher))?.taskStatus).toBe('finished');
  });

  it('refuses Active for a polygon that was never Completed', async () => {
    const a = await create();
    const res = await setStatus(a.id, { status: 'active' });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('INVALID_STATUS_CHANGE');
  });

  it('accepts no Coverage value and no other status', async () => {
    const a = await create();
    expect((await setStatus(a.id, { status: 'completed', coverage: 100 })).statusCode).toBe(200);
    expect((await setStatus(a.id, { status: 'unassigned' })).statusCode).toBe(400);
    const list = MissionPolygonList.parse(
      (await inject({ method: 'GET', url: `/api/missions/${missionId}/polygons` })).json(),
    );
    expect(list[0]?.coverage).toBeNull();
  });

  it('returns 404 for an unknown or deleted polygon', async () => {
    const a = await create();
    await inject({ method: 'DELETE', url: `/api/missions/${missionId}/polygons/${a.id}` });
    expect((await setStatus(a.id, { status: 'completed' })).statusCode).toBe(404);
  });

  it('is blocked once the mission has ended', async () => {
    const a = await create();
    await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));
    const res = await setStatus(a.id, { status: 'completed' });
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('MISSION_NOT_ACTIVE');
  });

  it('is for commanders only', async () => {
    const a = await create();
    const res = await ctx.app.inject({ method: 'PUT', url: url(a.id), payload: { status: 'completed' } });
    expect(res.statusCode).toBe(401);
  });

  it('reactivates a Completed polygon when a searcher is assigned to it', async () => {
    const a = await create();
    await setStatus(a.id, { status: 'completed' });
    const searcher = await addParticipant(ctx.db, { missionId, callsign: 4 });
    const res = await inject({
      method: 'PUT',
      url: `/api/missions/${missionId}/participants/${searcher}/assignment`,
      payload: { polygonId: a.id },
    });
    expect(res.statusCode).toBe(200);
    const [row] = await ctx.db.select({ status: polygons.status }).from(polygons).where(eq(polygons.id, a.id));
    expect(row?.status).toBe('active');
  });

  it('stops counting a finished searcher as active, so a Completed polygon can be deleted', async () => {
    const a = await create();
    await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    await addParticipant(ctx.db, { missionId, callsign: 5, polygonId: a.id, taskStatus: 'finished' });
    const count = async () => {
      const list = MissionPolygonList.parse(
        (await inject({ method: 'GET', url: `/api/missions/${missionId}/polygons` })).json(),
      );
      return list[0]?.activeSearchers;
    };
    expect(await count()).toBe(1);
    await setStatus(a.id, { status: 'completed', confirmActiveSearchers: true });
    expect(await count()).toBe(0);
    const del = await inject({ method: 'DELETE', url: `/api/missions/${missionId}/polygons/${a.id}` });
    expect(del.statusCode).toBe(204);
  });

  it('records Completed on the Timeline with the commander, the polygon and how many tasks ended', async () => {
    const a = await create();
    await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    await addParticipant(ctx.db, { missionId, callsign: 5, polygonId: a.id, taskStatus: 'paused' });
    await addParticipant(ctx.db, { missionId, callsign: 6, polygonId: a.id, taskStatus: 'finished' });
    await setStatus(a.id, { status: 'completed', confirmActiveSearchers: true });
    expect(await timeline()).toMatchObject([
      {
        type: 'polygon.completed',
        actor: { kind: 'commander' },
        subject: { kind: 'polygon', id: a.id, label: 'ואדי' },
        details: { endedTasks: 2 },
      },
    ]);
  });

  it('records Back to Active on the Timeline', async () => {
    const a = await create();
    await setStatus(a.id, { status: 'completed' });
    await setStatus(a.id, { status: 'active' });
    expect((await timeline()).map((e) => e.type)).toEqual(['polygon.completed', 'polygon.reactivated']);
  });

  it('records Back to Active when an assignment brings a Completed polygon back', async () => {
    const a = await create();
    await setStatus(a.id, { status: 'completed' });
    const searcher = await addParticipant(ctx.db, { missionId, callsign: 4 });
    await inject({
      method: 'PUT',
      url: `/api/missions/${missionId}/participants/${searcher}/assignment`,
      payload: { polygonId: a.id },
    });
    expect((await timeline()).map((e) => e.type)).toEqual(['polygon.completed', 'polygon.reactivated']);
  });

  it('records nothing for a refused or repeated change', async () => {
    const a = await create();
    await addParticipant(ctx.db, { missionId, callsign: 4, polygonId: a.id });
    await setStatus(a.id, { status: 'completed' });
    await setStatus(a.id, { status: 'active' });
    expect(await timeline()).toHaveLength(0);
    await setStatus(a.id, { status: 'completed', confirmActiveSearchers: true });
    await setStatus(a.id, { status: 'completed' });
    expect(await timeline()).toHaveLength(1);
  });
});
