import { ApiError, LkpDecisionResult, LkpPointList, Mission, Sighting, SightingList } from '@trace/schemas';
import { eq } from 'drizzle-orm';
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

const LKP_AT = '2026-10-03T13:05:00+03:00';
const LKP_POSITION = { type: 'Point', coordinates: [35.137, 31.769] };
const WITNESS_POSITION: [number, number] = [35.14, 31.77];

const issuePaths = (body: unknown) => {
  const details = ApiError.parse(body).error.details as { issues: { path: string }[] };
  return details.issues.map((issue) => issue.path);
};
const errorCode = (res: { json: () => unknown }) => ApiError.parse(res.json()).error.code;

describe('sightings', () => {
  let ctx: TestContext;
  let commander: Awaited<ReturnType<typeof signInCommander>>;
  let inject: ReturnType<typeof injectAs>;
  let missionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  const newMission = async (as: ReturnType<typeof injectAs>) => {
    const res = await as({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: LKP_POSITION, observedAt: LKP_AT },
      },
    });
    return Mission.parse(res.json()).id;
  };

  beforeEach(async () => {
    await resetDb(ctx.db);
    commander = await signInCommander(ctx);
    inject = injectAs(ctx, commander);
    missionId = await newMission(inject);
  });

  const sightingsUrl = (id = missionId) => `/api/missions/${id}/sightings`;
  const body = (overrides: Record<string, unknown> = {}) => ({
    position: { type: 'Point', coordinates: WITNESS_POSITION },
    observedAt: '2026-10-03T14:22:00+03:00',
    description: 'מטייל ראה אדם עם כובע אפור',
    source: 'witness',
    ...overrides,
  });
  const post = (payload: object, id = missionId, as = inject) => as({ method: 'POST', url: sightingsUrl(id), payload });
  const add = async (overrides: Record<string, unknown> = {}) => {
    const res = await post(body(overrides));
    expect(res.statusCode).toBe(201);
    return Sighting.parse(res.json());
  };
  const decideUrl = (sightingId: string, id = missionId) => `/api/missions/${id}/sightings/${sightingId}/lkp-decision`;
  const decide = (sightingId: string, decision: string, id = missionId, as = inject) =>
    as({ method: 'PUT', url: decideUrl(sightingId, id), payload: { decision } });
  const getMissionLkp = async () => {
    const res = await inject({ method: 'GET', url: `/api/missions/${missionId}` });
    return Mission.parse(res.json()).lkp;
  };
  const getLkps = async () => {
    const res = await inject({ method: 'GET', url: `/api/missions/${missionId}/lkps` });
    expect(res.statusCode).toBe(200);
    return LkpPointList.parse(res.json());
  };
  const getSightings = async () => {
    const res = await inject({ method: 'GET', url: sightingsUrl() });
    expect(res.statusCode).toBe(200);
    return SightingList.parse(res.json());
  };

  describe('add', () => {
    it('saves location, time, description and source', async () => {
      const res = await post(body());
      expect(res.statusCode).toBe(201);
      const sighting = Sighting.parse(res.json());
      expect(sighting.position.coordinates).toEqual(WITNESS_POSITION);
      expect(new Date(sighting.observedAt).getTime()).toBe(new Date('2026-10-03T14:22:00+03:00').getTime());
      expect(sighting.description).toBe('מטייל ראה אדם עם כובע אפור');
      expect(sighting.source).toBe('witness');
      expect(sighting.number).toBe(1);
      expect(sighting.reportedBy).toEqual({ role: 'commander', name: 'מנהל', callsign: null });
      expect(sighting.lkpDecision).toBeNull();
      expect(await getSightings()).toEqual([sighting]);
    });

    it('numbers sightings in the order they were added', async () => {
      const a = await add();
      const b = await add({ source: 'self' });
      expect([a.number, b.number]).toEqual([1, 2]);
      expect((await getSightings()).map((s) => s.id)).toEqual([a.id, b.id]);
    });

    it('turns a blank or missing description into null', async () => {
      expect((await add({ description: '  ' })).description).toBeNull();
      expect((await add({ description: undefined })).description).toBeNull();
    });

    it.each(['position', 'observedAt', 'source'])('rejects a sighting without %s', async (key) => {
      const res = await post(body({ [key]: undefined }));
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('VALIDATION_ERROR');
      expect(issuePaths(res.json())).toContain(`/${key}`);
    });

    it('rejects a time without a time-zone offset', async () => {
      expect((await post(body({ observedAt: '2026-10-03T14:22' }))).statusCode).toBe(400);
    });

    it('rejects an unknown source', async () => {
      expect((await post(body({ source: 'certain' }))).statusCode).toBe(400);
    });

    it('rejects a description over 2000 characters', async () => {
      expect((await post(body({ description: 'א'.repeat(2001) }))).statusCode).toBe(400);
    });

    it('does not change the LKP', async () => {
      const before = await getMissionLkp();
      await add();
      expect(await getMissionLkp()).toEqual(before);
      expect(await getLkps()).toHaveLength(1);
    });
  });

  describe('from a searcher (UC-F10)', () => {
    let searcher: Awaited<ReturnType<typeof signInSearcher>>;
    let asSearcher: ReturnType<typeof injectAs>;
    const ID = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d';

    beforeEach(async () => {
      searcher = await signInSearcher(ctx, { name: 'אלון שגיא' });
      await addParticipant(ctx.db, { missionId, callsign: 7, searcherId: searcher.searcherId });
      asSearcher = injectAs(ctx, searcher);
    });

    const postAsSearcher = (overrides: Record<string, unknown> = {}, id = missionId) =>
      post(body(overrides), id, asSearcher);

    it('saves the sighting with its source and the searcher as reporter', async () => {
      const res = await postAsSearcher({ source: 'self' });
      expect(res.statusCode).toBe(201);
      const sighting = Sighting.parse(res.json());
      expect(sighting.source).toBe('self');
      expect(sighting.reportedBy).toEqual({ role: 'searcher', name: 'אלון שגיא', callsign: 7 });
      expect(await getSightings()).toEqual([sighting]);
    });

    it('does not change the LKP', async () => {
      const before = await getMissionLkp();
      await postAsSearcher({ observedAt: '2026-10-03T14:22:00+03:00' });
      expect(await getMissionLkp()).toEqual(before);
      expect(await getLkps()).toHaveLength(1);
    });

    it('suggests a sighting later than the LKP and leaves the decision to the commander', async () => {
      const sighting = Sighting.parse((await postAsSearcher({ observedAt: '2026-10-03T14:22:00+03:00' })).json());
      expect(sighting.lkpCandidate).toBe(true);
      expect((await getSightings())[0]).toMatchObject({ lkpCandidate: true, lkpDecision: null });
    });

    it('does not suggest an earlier sighting', async () => {
      const sighting = Sighting.parse((await postAsSearcher({ observedAt: '2026-10-03T12:00:00+03:00' })).json());
      expect(sighting.lkpCandidate).toBe(false);
    });

    it('answers 200 with the same sighting when the phone sends the same id again', async () => {
      const first = await postAsSearcher({ id: ID });
      const again = await postAsSearcher({ id: ID });
      expect(first.statusCode).toBe(201);
      expect(again.statusCode).toBe(200);
      expect(Sighting.parse(again.json())).toEqual(Sighting.parse(first.json()));
      expect(Sighting.parse(first.json()).id).toBe(ID);
      expect(await getSightings()).toHaveLength(1);
    });

    it('refuses an id that belongs to another reporter', async () => {
      await add({ id: ID });
      const res = await postAsSearcher({ id: ID });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('SIGHTING_ID_TAKEN');
      expect(await getSightings()).toHaveLength(1);
    });

    it('refuses an id that belongs to a sighting of another mission', async () => {
      const otherMissionId = await newMission(inject);
      await addParticipant(ctx.db, { missionId: otherMissionId, callsign: 7, searcherId: searcher.searcherId });
      expect((await postAsSearcher({ id: ID }, otherMissionId)).statusCode).toBe(201);
      const res = await postAsSearcher({ id: ID });
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('SIGHTING_ID_TAKEN');
    });

    it('refuses a searcher whose participation ended', async () => {
      const other = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 8, searcherId: other.searcherId, status: 'ended' });
      const res = await post(body(), missionId, injectAs(ctx, other));
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('PARTICIPATION_ENDED');
      expect(await getSightings()).toHaveLength(0);
    });

    it('lets an available searcher without a polygon report', async () => {
      expect((await postAsSearcher()).statusCode).toBe(201);
    });

    it('is read-only once the mission ended', async () => {
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, missionId));
      const res = await postAsSearcher();
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('MISSION_ENDED');
    });

    it('answers 404 to a searcher outside the mission', async () => {
      const outsider = injectAs(ctx, await signInSearcher(ctx));
      expect((await post(body(), missionId, outsider)).statusCode).toBe(404);
    });

    it('allows a report while the mission is paused', async () => {
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      expect((await postAsSearcher()).statusCode).toBe(201);
    });
  });

  it('lets a commander send an id too', async () => {
    const id = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0e';
    expect((await post(body({ id }))).statusCode).toBe(201);
    expect((await post(body({ id }))).statusCode).toBe(200);
    expect(await getSightings()).toHaveLength(1);
  });

  describe('LKP suggestion', () => {
    it('suggests a sighting later than the LKP', async () => {
      expect((await add({ observedAt: '2026-10-03T14:22:00+03:00' })).lkpCandidate).toBe(true);
    });

    it('does not suggest an earlier sighting', async () => {
      expect((await add({ observedAt: '2026-10-03T12:00:00+03:00' })).lkpCandidate).toBe(false);
    });

    it('compares instants, not the written offset', async () => {
      // The LKP, 13:05 in +03:00, is 10:05Z.
      expect((await add({ observedAt: '2026-10-03T10:30:00Z' })).lkpCandidate).toBe(true);
      expect((await add({ observedAt: '2026-10-03T13:30:00+05:00' })).lkpCandidate).toBe(false);
      expect((await add({ observedAt: '2026-10-03T10:05:00Z' })).lkpCandidate).toBe(false);
    });

    it('lists the same candidacy that adding returned', async () => {
      const later = await add();
      const earlier = await add({ observedAt: '2026-10-03T12:00:00+03:00' });
      const listed = await getSightings();
      expect(listed.map((s) => [s.id, s.lkpCandidate])).toEqual([
        [later.id, true],
        [earlier.id, false],
      ]);
    });
  });

  describe('accept', () => {
    it('makes the sighting the current LKP and keeps the old one as history', async () => {
      const original = await getMissionLkp();
      const sighting = await add();
      const res = await decide(sighting.id, 'accepted');
      expect(res.statusCode).toBe(200);
      const result = LkpDecisionResult.parse(res.json());
      expect(result.lkp.position).toEqual(sighting.position);
      expect(new Date(result.lkp.observedAt).getTime()).toBe(new Date(sighting.observedAt).getTime());
      expect(result.sighting).toMatchObject({ id: sighting.id, lkpDecision: 'accepted', lkpCandidate: false });
      expect(await getMissionLkp()).toEqual(result.lkp);

      const lkps = await getLkps();
      expect(lkps).toHaveLength(2);
      expect(lkps[0]).toMatchObject({ current: true, sightingId: sighting.id, setBy: 'מנהל' });
      expect(lkps[1]).toMatchObject({ current: false, sightingId: null, position: original?.position });
      expect(lkps.filter((p) => p.current)).toHaveLength(1);
    });

    it('stops suggesting an earlier sighting once a later one is the LKP', async () => {
      const a = await add({ observedAt: '2026-10-03T14:22:00+03:00' });
      const b = await add({ observedAt: '2026-10-03T16:02:00+03:00' });
      expect((await decide(b.id, 'accepted')).statusCode).toBe(200);
      expect((await getSightings()).find((s) => s.id === a.id)?.lkpCandidate).toBe(false);
      const res = await decide(a.id, 'accepted');
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('SIGHTING_NOT_LKP_CANDIDATE');
    });

    it('cannot decide twice', async () => {
      const sighting = await add();
      await decide(sighting.id, 'accepted');
      const lkp = await getMissionLkp();
      for (const decision of ['accepted', 'rejected']) {
        const res = await decide(sighting.id, decision);
        expect(res.statusCode).toBe(409);
        expect(errorCode(res)).toBe('SIGHTING_NOT_LKP_CANDIDATE');
      }
      expect(await getMissionLkp()).toEqual(lkp);
    });

    it('cannot accept a sighting earlier than the LKP', async () => {
      const sighting = await add({ observedAt: '2026-10-03T12:00:00+03:00' });
      const res = await decide(sighting.id, 'accepted');
      expect(res.statusCode).toBe(409);
      expect(errorCode(res)).toBe('SIGHTING_NOT_LKP_CANDIDATE');
      expect(await getLkps()).toHaveLength(1);
    });

    it('keeps exactly one current LKP under concurrent decisions', async () => {
      const a = await add({ observedAt: '2026-10-03T14:22:00+03:00' });
      const b = await add({ observedAt: '2026-10-03T16:02:00+03:00' });
      const results = await Promise.all([decide(a.id, 'accepted'), decide(b.id, 'accepted')]);
      const statuses = results.map((res) => res.statusCode);
      expect(statuses.every((status) => status === 200 || status === 409)).toBe(true);
      expect(statuses).toContain(200);
      expect((await getLkps()).filter((p) => p.current)).toHaveLength(1);
      expect(new Date((await getMissionLkp())?.observedAt ?? '').getTime()).toBe(new Date(b.observedAt).getTime());
    });

    it('stamps rows when the mission lock is taken, not when the request started', async () => {
      const a = await add({ observedAt: '2026-10-03T14:22:00+03:00' });
      let releasedAt = 0;
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => (locked = resolve));
      const holder = ctx.db.transaction(async (tx) => {
        await tx.select({ id: missions.id }).from(missions).where(eq(missions.id, missionId)).for('update');
        locked();
        await held;
        releasedAt = Date.now();
      });
      await lockTaken;
      const waiting = Promise.all([decide(a.id, 'accepted'), post(body())]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await holder;
      const [decided, created] = await waiting;
      expect(decided.statusCode).toBe(200);
      expect(created.statusCode).toBe(201);
      const [current] = await getLkps();
      expect(new Date(current?.createdAt ?? '').getTime()).toBeGreaterThanOrEqual(releasedAt);
      expect(new Date(Sighting.parse(created.json()).createdAt).getTime()).toBeGreaterThanOrEqual(releasedAt);
    });

    it('records who set the LKP created with the mission', async () => {
      const lkps = await getLkps();
      expect(lkps).toHaveLength(1);
      expect(lkps[0]).toMatchObject({ current: true, sightingId: null, setBy: 'מנהל' });
    });
  });

  describe('reject', () => {
    it('leaves the LKP as it was', async () => {
      const before = await getMissionLkp();
      const sighting = await add();
      const res = await decide(sighting.id, 'rejected');
      expect(res.statusCode).toBe(200);
      const result = LkpDecisionResult.parse(res.json());
      expect(result.lkp).toEqual(before);
      expect(result.sighting).toMatchObject({ lkpDecision: 'rejected', lkpCandidate: false });
      expect(await getMissionLkp()).toEqual(before);
      expect(await getLkps()).toHaveLength(1);
      expect((await getSightings()).map((s) => s.id)).toContain(sighting.id);
    });
  });

  describe('mission status', () => {
    it('allows changes while paused', async () => {
      await ctx.db.update(missions).set({ status: 'paused' }).where(eq(missions.id, missionId));
      const sighting = await add();
      expect((await decide(sighting.id, 'accepted')).statusCode).toBe(200);
    });

    it.each(['ended_located', 'ended_stopped'] as const)('is read-only once %s', async (status) => {
      const sighting = await add();
      await ctx.db.update(missions).set({ status }).where(eq(missions.id, missionId));
      const added = await post(body());
      expect(added.statusCode).toBe(409);
      expect(errorCode(added)).toBe('MISSION_ENDED');
      const decided = await decide(sighting.id, 'accepted');
      expect(decided.statusCode).toBe(409);
      expect(errorCode(decided)).toBe('MISSION_ENDED');
      expect(await getSightings()).toHaveLength(1);
      expect(await getLkps()).toHaveLength(1);
    });
  });

  describe('access', () => {
    it('does not reveal another commander’s mission', async () => {
      const sighting = await add();
      const other = injectAs(ctx, await signInCommander(ctx));
      const urls = [
        other({ method: 'GET', url: sightingsUrl() }),
        post(body(), missionId, other),
        decide(sighting.id, 'accepted', missionId, other),
        other({ method: 'GET', url: `/api/missions/${missionId}/lkps` }),
      ];
      for (const res of await Promise.all(urls)) expect(res.statusCode).toBe(404);
    });

    it('does not decide a sighting of another mission', async () => {
      const otherMissionId = await newMission(inject);
      const elsewhere = Sighting.parse((await post(body(), otherMissionId)).json());
      const res = await decide(elsewhere.id, 'accepted');
      expect(res.statusCode).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    });

    it('answers 404 for an unknown sighting and 400 for malformed ids', async () => {
      expect((await decide('6a3b1c1e-3f6b-4c1d-9d5e-1c2b3a4d5e6f', 'accepted')).statusCode).toBe(404);
      expect((await decide('nope', 'accepted')).statusCode).toBe(400);
      expect((await inject({ method: 'GET', url: sightingsUrl('nope') })).statusCode).toBe(400);
      expect(
        (await inject({ method: 'GET', url: sightingsUrl('6a3b1c1e-3f6b-4c1d-9d5e-1c2b3a4d5e6f') })).statusCode,
      ).toBe(404);
    });

    it('requires a session', async () => {
      const sighting = await add();
      const calls = [
        ctx.app.inject({ method: 'GET', url: sightingsUrl() }),
        ctx.app.inject({ method: 'POST', url: sightingsUrl(), payload: body() }),
        ctx.app.inject({ method: 'PUT', url: decideUrl(sighting.id), payload: { decision: 'accepted' } }),
        ctx.app.inject({ method: 'GET', url: `/api/missions/${missionId}/lkps` }),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.statusCode).toBe(401);
        expect(errorCode(res)).toBe('UNAUTHENTICATED');
      }
    });

    it('lets a searcher in the mission add a sighting and read the LKP history, but not list or decide sightings', async () => {
      const searcher = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId, callsign: 7, searcherId: searcher.searcherId });
      const asSearcher = injectAs(ctx, searcher);
      const sighting = await add();
      expect((await asSearcher({ method: 'GET', url: sightingsUrl() })).statusCode).toBe(403);
      expect((await post(body(), missionId, asSearcher)).statusCode).toBe(201);
      expect((await decide(sighting.id, 'accepted', missionId, asSearcher)).statusCode).toBe(403);
      const lkps = await asSearcher({ method: 'GET', url: `/api/missions/${missionId}/lkps` });
      expect(lkps.statusCode).toBe(200);
      expect(LkpPointList.parse(lkps.json()).filter((p) => p.current)).toHaveLength(1);
    });

    it('does not show the LKP history to a searcher outside the mission', async () => {
      const searcher = await signInSearcher(ctx);
      const res = await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${missionId}/lkps` });
      expect(res.statusCode).toBe(404);
    });

    it('rejects an invalid decision', async () => {
      const sighting = await add();
      const res = await decide(sighting.id, 'maybe');
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('VALIDATION_ERROR');
    });
  });
});
