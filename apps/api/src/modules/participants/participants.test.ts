import { JoinedMission, JoinPreview, Mission, ParticipantList, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions } from '../../db/schema';
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
