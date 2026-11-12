import {
  JoinedMission,
  JoinPreview,
  Mission,
  MissionPolygonList,
  Participant,
  ParticipantList,
  type MissionEvent,
} from '@trace/schemas';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assignments, missions, participations, trackPoints } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInByPhone,
  signInCommander,
  signInSearcher,
  type TestContext,
} from '../../testing';

describe('participants', () => {
  let ctx: TestContext;
  let inject: ReturnType<typeof injectAs>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.db);
    inject = injectAs(ctx, await signInCommander(ctx));
  });
  afterAll(() => ctx.close());

  it('lists searchers by callsign with their last position', async () => {
    const res = await inject({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    const missionId = Mission.parse(res.json()).id;
    await addParticipant(ctx.db, { missionId, callsign: 9 });
    await addParticipant(ctx.db, { missionId, callsign: 4, position: [35.128, 31.775] });

    const list = ParticipantList.parse(
      (await inject({ method: 'GET', url: `/api/missions/${missionId}/participants` })).json(),
    );
    expect(list.map((p) => p.callsign)).toEqual([4, 9]);
    expect(list[0]).toMatchObject({ name: 'מחפש 4', status: 'available', position: [35.128, 31.775] });
    expect(list[0]?.phone).toMatch(/^\+9725\d{8}$/);
    expect(list[1]?.position).toBeNull();
  });
});

describe('joining a mission (UC-F02)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;

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
        name: 'מסע 0412',
        missingPerson: { name: 'נועם אברהם', age: 74 },
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    mission = Mission.parse(res.json());
  });
  afterAll(() => ctx.close());

  const setStatus = (status: Mission['status']) =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));

  it('shows the mission of a code before joining, in any letter case', async () => {
    const searcher = injectAs(ctx, await signInSearcher(ctx));
    const res = await searcher({ method: 'GET', url: `/api/join/${mission.joinCode.toLowerCase()}` });

    expect(res.statusCode).toBe(200);
    expect(JoinPreview.parse(res.json())).toEqual({
      name: 'מסע 0412',
      status: 'active',
      missingPerson: { name: 'נועם אברהם', age: 74 },
    });
  });

  it('adds the searcher as available with the lowest free callsign and tells the commander', async () => {
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1 });
    const published: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      published.push(event);
      publish(event);
    };
    const user = await signInSearcher(ctx, { name: 'דנה כהן' });
    const res = await injectAs(ctx, user)({ method: 'POST', url: `/api/join/${mission.joinCode}` });
    ctx.realtime.publish = publish;

    expect(res.statusCode).toBe(201);
    const joined = JoinedMission.parse(res.json());
    expect(joined.mission.id).toBe(mission.id);
    expect(joined.participation).toMatchObject({ callsign: 2, status: 'available', polygonId: null, taskStatus: null });

    const list = ParticipantList.parse(
      (await commander({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json(),
    );
    expect(list.find((p) => p.id === joined.participation.id)).toMatchObject({
      searcherId: user.searcherId,
      name: 'דנה כהן',
      status: 'available',
    });
    expect(published).toMatchObject([
      { type: 'participant.joined', missionId: mission.id, participant: { id: joined.participation.id, callsign: 2 } },
    ]);
    // The searcher is now a member: the mission and its map open for them.
    expect((await injectAs(ctx, user)({ method: 'GET', url: `/api/missions/${mission.id}` })).statusCode).toBe(200);
  });

  it('returns the same participation when the searcher joins again, even after the mission paused', async () => {
    const searcher = injectAs(ctx, await signInSearcher(ctx));
    const first = JoinedMission.parse(
      (await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` })).json(),
    );
    await setStatus('paused');
    const again = await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` });

    expect(again.statusCode).toBe(200);
    expect(JoinedMission.parse(again.json()).participation).toEqual(first.participation);
    const list = (await commander({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json();
    expect(ParticipantList.parse(list)).toHaveLength(1);
  });

  it('returns an ended participation to available with its callsign, on an active mission only', async () => {
    const user = await signInSearcher(ctx);
    const searcher = injectAs(ctx, user);
    const id = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 5,
      searcherId: user.searcherId,
      status: 'ended',
    });
    await setStatus('paused');
    expect((await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` })).statusCode).toBe(409);

    await setStatus('active');
    const res = await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` });
    expect(res.statusCode).toBe(201);
    expect(JoinedMission.parse(res.json()).participation).toMatchObject({ id, callsign: 5, status: 'available' });
  });

  it('gives searchers who join at once different callsigns', async () => {
    const users = await Promise.all([signInSearcher(ctx), signInSearcher(ctx), signInSearcher(ctx)]);
    const results = await Promise.all(
      users.map((user) => injectAs(ctx, user)({ method: 'POST', url: `/api/join/${mission.joinCode}` })),
    );

    expect(results.map((res) => res.statusCode)).toEqual([201, 201, 201]);
    const callsigns = results.map((res) => JoinedMission.parse(res.json()).participation.callsign);
    expect([...callsigns].sort()).toEqual([1, 2, 3]);
  });

  it('answers 404 for a code no mission has', async () => {
    const searcher = injectAs(ctx, await signInSearcher(ctx));
    for (const method of ['GET', 'POST'] as const) {
      const res = await searcher({ method, url: '/api/join/ZZ-ZZZ' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
  });

  it.each(['paused', 'ended_located', 'ended_stopped'] as const)(
    'refuses a new searcher when the mission is %s',
    async (status) => {
      await setStatus(status);
      const searcher = injectAs(ctx, await signInSearcher(ctx));
      const res = await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: { code: 'MISSION_NOT_ACTIVE' } });
      const list = (await commander({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json();
      expect(ParticipantList.parse(list)).toHaveLength(0);
    },
  );

  it('refuses once every callsign is taken', async () => {
    for (let callsign = 1; callsign <= 99; callsign++)
      await addParticipant(ctx.db, { missionId: mission.id, callsign });
    const searcher = injectAs(ctx, await signInSearcher(ctx));
    const res = await searcher({ method: 'POST', url: `/api/join/${mission.joinCode}` });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'MISSION_FULL' } });
  });

  it('is for searchers with a profile only', async () => {
    const url = `/api/join/${mission.joinCode}`;
    expect((await commander({ method: 'POST', url })).statusCode).toBe(403);
    expect((await commander({ method: 'GET', url })).statusCode).toBe(403);
    const nameless = injectAs(ctx, await signInByPhone(ctx));
    expect((await nameless({ method: 'POST', url })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'POST', url })).statusCode).toBe(401);
  });
});

describe('what a searcher sees of other searchers (UC-F04, decisions 31, 32)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDb(ctx.db));
  afterAll(() => ctx.close());

  it('never gets their positions, before an assignment or during one', async () => {
    const commander = injectAs(ctx, await signInCommander(ctx));
    const created = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    const mission = Mission.parse(created.json());
    const polygon = await commander({
      method: 'POST',
      url: `/api/missions/${mission.id}/polygons`,
      payload: {
        name: 'A',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [35.12, 31.77],
              [35.14, 31.77],
              [35.14, 31.79],
              [35.12, 31.77],
            ],
          ],
        },
      },
    });
    const polygonId = (polygon.json() as { id: string }).id;
    // Another searcher, assigned and with a known position.
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, polygonId, position: [35.131, 31.781] });
    // One searcher waits for an assignment, the other is assigned to the same polygon.
    const waiting = injectAs(ctx, await signInSearcher(ctx));
    await waiting({ method: 'POST', url: `/api/join/${mission.joinCode}` });
    const assignedUser = await signInSearcher(ctx);
    await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 3,
      searcherId: assignedUser.searcherId,
      polygonId,
    });

    for (const searcher of [waiting, injectAs(ctx, assignedUser)]) {
      for (const path of ['participants', 'sightings', 'timeline']) {
        const res = await searcher({ method: 'GET', url: `/api/missions/${mission.id}/${path}` });
        expect(res.statusCode, path).toBe(403);
      }
      for (const path of ['', '/polygons', '/lkps']) {
        const res = await searcher({ method: 'GET', url: `/api/missions/${mission.id}${path}` });
        expect(res.statusCode, path).toBe(200);
        expect(res.body, path).not.toContain('35.131');
      }
    }
  });
});

describe('assigning a searcher (UC-C09)', () => {
  let ctx: TestContext;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let polygonA: string;
  let polygonB: string;

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
    const create = async (name: string, lng: number) =>
      (
        (
          await commander({
            method: 'POST',
            url: `/api/missions/${mission.id}/polygons`,
            payload: { name, geometry: square(lng) },
          })
        ).json() as { id: string }
      ).id;
    polygonA = await create('A', 35.12);
    polygonB = await create('B', 35.14);
  });
  afterAll(() => ctx.close());

  const assign = (participantId: string, polygonId: string, as = commander) =>
    as({
      method: 'PUT',
      url: `/api/missions/${mission.id}/participants/${participantId}/assignment`,
      payload: { polygonId },
    });
  const history = (participationId: string) =>
    ctx.db
      .select({ polygonId: assignments.polygonId, endedAt: assignments.endedAt })
      .from(assignments)
      .where(eq(assignments.participationId, participationId))
      .orderBy(asc(assignments.assignedAt));
  const polygonStatus = async (id: string) =>
    MissionPolygonList.parse(
      (await commander({ method: 'GET', url: `/api/missions/${mission.id}/polygons` })).json(),
    ).find((p) => p.id === id)?.status;

  it('assigns an available searcher, who waits at Ready, and activates the polygon', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    const res = await assign(id, polygonA);

    expect(res.statusCode).toBe(200);
    expect(Participant.parse(res.json())).toMatchObject({
      status: 'assigned',
      polygonId: polygonA,
      taskStatus: 'ready',
    });
    expect(await history(id)).toMatchObject([{ polygonId: polygonA, endedAt: null }]);
    expect(await polygonStatus(polygonA)).toBe('active');
  });

  it('lets the searcher read their own participation, and only theirs', async () => {
    const user = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: user.searcherId });
    await assign(id, polygonA);
    const res = await injectAs(ctx, user)({ method: 'GET', url: `/api/missions/${mission.id}/participation` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, callsign: 4, status: 'assigned', polygonId: polygonA, taskStatus: 'ready' });
    expect((await commander({ method: 'GET', url: `/api/missions/${mission.id}/participation` })).statusCode).toBe(403);
    const outsider = injectAs(ctx, await signInSearcher(ctx));
    expect((await outsider({ method: 'GET', url: `/api/missions/${mission.id}/participation` })).statusCode).toBe(404);
  });

  it('puts two searchers in one polygon', async () => {
    const first = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    const second = await addParticipant(ctx.db, { missionId: mission.id, callsign: 5 });
    expect((await assign(first, polygonA)).statusCode).toBe(200);
    expect((await assign(second, polygonA)).statusCode).toBe(200);
  });

  it('moves a searching searcher: the old task ends and stays in the history, the new one starts at Ready', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    await assign(id, polygonA);
    await ctx.db.update(participations).set({ taskStatus: 'searching' }).where(eq(participations.id, id));
    const res = await assign(id, polygonB);

    expect(Participant.parse(res.json())).toMatchObject({ polygonId: polygonB, taskStatus: 'ready' });
    const rows = await history(id);
    expect(rows.map((r) => r.polygonId)).toEqual([polygonA, polygonB]);
    expect(rows[0]?.endedAt).not.toBeNull();
    expect(rows[1]?.endedAt).toBeNull();
  });

  it('changes nothing when the searcher is assigned to the same polygon again', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    await assign(id, polygonA);
    await assign(id, polygonA);
    expect(await history(id)).toHaveLength(1);
  });

  it('never gives a searcher two open assignments, even when two moves arrive at once', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    const results = await Promise.all([assign(id, polygonA), assign(id, polygonB)]);

    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect((await history(id)).filter((r) => r.endedAt === null)).toHaveLength(1);
  });

  it('never leaves a searcher in a polygon deleted at the same moment', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    const [assigned, deleted] = await Promise.all([
      assign(id, polygonA),
      commander({ method: 'DELETE', url: `/api/missions/${mission.id}/polygons/${polygonA}` }),
    ]);

    // One of them wins: the assignment blocks the delete, or the deleted polygon cannot be assigned.
    expect([assigned.statusCode, deleted.statusCode].sort()).toEqual(
      assigned.statusCode === 200 ? [200, 409] : [204, 404].sort(),
    );
  });

  it('announces the assignment and the polygon that became active', async () => {
    const published: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      published.push(event);
      publish(event);
    };
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    await assign(id, polygonA);
    ctx.realtime.publish = publish;

    expect(published.map((e) => e.type)).toEqual(['participant.updated', 'polygon.saved']);
  });

  it('ends a participation, keeping the route, and lets the searcher join again as available (UC-C18)', async () => {
    const user = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: user.searcherId });
    await assign(id, polygonA);
    await ctx.db.update(participations).set({ taskStatus: 'searching' }).where(eq(participations.id, id));
    await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${mission.id}/track-points`,
      payload: { points: [{ position: [35.125, 31.775], recordedAt: '2026-10-03T13:05:00+03:00', context: 'search' }] },
    });
    const end = () => commander({ method: 'POST', url: `/api/missions/${mission.id}/participants/${id}/end` });
    const published: MissionEvent[] = [];
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event) => {
      published.push(event);
      publish(event);
    };
    const res = await end();
    ctx.realtime.publish = publish;
    expect(published).toMatchObject([
      { type: 'participant.updated', participant: { id, searcherId: user.searcherId, status: 'ended' } },
    ]);

    expect(res.statusCode).toBe(200);
    expect(Participant.parse(res.json())).toMatchObject({ status: 'ended', polygonId: null, taskStatus: null });
    expect((await history(id)).every((row) => row.endedAt !== null)).toBe(true);
    expect(await ctx.db.select().from(trackPoints).where(eq(trackPoints.participationId, id))).toHaveLength(1);
    expect((await end()).statusCode).toBe(200);

    const rejoin = await injectAs(ctx, user)({ method: 'POST', url: `/api/join/${mission.joinCode}` });
    expect(rejoin.statusCode).toBe(201);
    expect(JoinedMission.parse(rejoin.json()).participation).toMatchObject({ id, status: 'available' });
  });

  it('ends a participation after the mission ended too, since tracking continues until Finish Activity', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    await ctx.db.update(missions).set({ status: 'ended_located' }).where(eq(missions.id, mission.id));
    const res = await commander({ method: 'POST', url: `/api/missions/${mission.id}/participants/${id}/end` });
    expect(Participant.parse(res.json()).status).toBe('ended');
  });

  it('records a lost GPS for the commander, and clears it when GPS or a fix comes back (decision 42)', async () => {
    const user = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: user.searcherId });
    const gps = (available: boolean) =>
      injectAs(
        ctx,
        user,
      )({ method: 'PUT', url: `/api/missions/${mission.id}/participation/gps`, payload: { available } });
    const since = async () =>
      ParticipantList.parse(
        (await commander({ method: 'GET', url: `/api/missions/${mission.id}/participants` })).json(),
      ).find((p) => p.id === id)?.gpsUnavailableSince;

    expect((await gps(false)).statusCode).toBe(204);
    const lost = await since();
    expect(lost).not.toBeNull();
    await gps(false);
    expect(await since()).toBe(lost);
    await gps(true);
    expect(await since()).toBeNull();

    await gps(false);
    const upload = (recordedAt: string) =>
      injectAs(
        ctx,
        user,
      )({
        method: 'POST',
        url: `/api/missions/${mission.id}/track-points`,
        payload: { points: [{ position: [35.125, 31.775], recordedAt, context: 'safety' }] },
      });
    // A batch recorded before the loss and delivered after it does not clear it.
    await upload(new Date(Date.now() - 60_000).toISOString());
    expect(await since()).not.toBeNull();
    await upload(new Date(Date.now() + 1000).toISOString());
    expect(await since()).toBeNull();
    expect(
      (
        await commander({
          method: 'PUT',
          url: `/api/missions/${mission.id}/participation/gps`,
          payload: { available: false },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('lets only the commander end a participation', async () => {
    const user = await signInSearcher(ctx);
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: user.searcherId });
    const res = await injectAs(
      ctx,
      user,
    )({ method: 'POST', url: `/api/missions/${mission.id}/participants/${id}/end` });
    expect(res.statusCode).toBe(403);
    const missing = '00000000-0000-4000-8000-000000000999';
    expect(
      (await commander({ method: 'POST', url: `/api/missions/${mission.id}/participants/${missing}/end` })).statusCode,
    ).toBe(404);
  });

  it('refuses a polygon off the map, an ended activity, an ended mission and a searcher', async () => {
    const id = await addParticipant(ctx.db, { missionId: mission.id, callsign: 4 });
    const missing = await assign(id, '00000000-0000-4000-8000-000000000999');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'POLYGON_NOT_FOUND' } });

    const ended = await addParticipant(ctx.db, { missionId: mission.id, callsign: 5, status: 'ended' });
    expect((await assign(ended, polygonA)).json()).toMatchObject({ error: { code: 'PARTICIPATION_ENDED' } });

    const user = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 6, searcherId: user.searcherId });
    expect((await assign(id, polygonA, injectAs(ctx, user))).statusCode).toBe(403);

    await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, mission.id));
    expect((await assign(id, polygonA)).json()).toMatchObject({ error: { code: 'MISSION_ENDED' } });
  });
});
