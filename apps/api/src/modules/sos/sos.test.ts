import { SOS_MESSAGE_MAX_LENGTH, ApiError, Mission, MissionPolygon, Sos, SosList, TimelineEventList } from '@trace/schemas';
import type { MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { Polygon } from 'geojson';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, participations, sosAlerts } from '../../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  resetDb,
  signInByPhone,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../../testing';

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
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const location = {
  position: { type: 'Point', coordinates: [35.13, 31.778] },
  recordedAt: '2026-10-03T14:22:00+03:00',
  accuracy: 12,
};

interface Published {
  event: MissionEvent;
  searcherIds: readonly string[] | undefined;
}

describe('SOS (UC-F13)', () => {
  let ctx: TestContext;
  let commanderUser: TestUser;
  let commander: ReturnType<typeof injectAs>;
  let mission: Mission;
  let polygonA: MissionPolygon;
  let polygonB: MissionPolygon;
  let sender: Awaited<ReturnType<typeof signInSearcher>>;
  let senderParticipationId: string;
  let a1: Awaited<ReturnType<typeof signInSearcher>>;
  let b1: Awaited<ReturnType<typeof signInSearcher>>;
  let available: Awaited<ReturnType<typeof signInSearcher>>;
  let published: Published[];

  beforeAll(async () => {
    ctx = await createTestApp();
    const publish = ctx.realtime.publish.bind(ctx.realtime);
    ctx.realtime.publish = (event, options) => {
      published.push({ event, searcherIds: options?.searcherIds });
      publish(event, options);
    };
  });
  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDb(ctx.db);
    published = [];
    commanderUser = await signInCommander(ctx);
    commander = injectAs(ctx, commanderUser);
    const created = await commander({
      method: 'POST',
      url: '/api/missions',
      payload: {
        name: 'מסע',
        rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
        lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
      },
    });
    mission = Mission.parse(created.json());
    const polygon = async (name: string, geometry: Polygon) =>
      MissionPolygon.parse(
        (
          await commander({ method: 'POST', url: `/api/missions/${mission.id}/polygons`, payload: { name, geometry } })
        ).json(),
      );
    polygonA = await polygon('A', box(35.122, 31.77, 35.136, 31.781));
    polygonB = await polygon('B', box(35.15, 31.77, 35.16, 31.78));
    sender = await signInSearcher(ctx, { name: 'אלון שגיא' });
    senderParticipationId = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 7,
      searcherId: sender.searcherId,
      polygonId: polygonA.id,
      position: [35.128, 31.775],
    });
    a1 = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: a1.searcherId, polygonId: polygonA.id });
    b1 = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 2, searcherId: b1.searcherId, polygonId: polygonB.id });
    available = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 3, searcherId: available.searcherId });
    published = [];
  });

  const url = (path = '') => `/api/missions/${mission.id}/sos${path}`;
  const activate = (user: TestUser = sender, payload: unknown = { location }) =>
    injectAs(ctx, user)({ method: 'POST', url: url(), payload: payload as object });
  const close = (id: string, user: TestUser = sender) => injectAs(ctx, user)({ method: 'POST', url: url(`/${id}/close`) });
  const list = async (user: TestUser = commanderUser) =>
    SosList.parse((await injectAs(ctx, user)({ method: 'GET', url: url() })).json());
  const savedEvents = () => published.filter((p) => p.event.type === 'sos.saved');
  const setMission = (status: Mission['status']) =>
    ctx.db.update(missions).set({ status }).where(eq(missions.id, mission.id));

  it('saves an active SOS with the location and the polygon', async () => {
    const res = await activate(sender, { message: ' נפלתי ', location });
    expect(res.statusCode).toBe(201);
    const sos = Sos.parse(res.json());
    expect(sos).toMatchObject({
      missionId: mission.id,
      status: 'active',
      sender: { searcherId: sender.searcherId, callsign: 7, name: 'אלון שגיא' },
      polygon: { id: polygonA.id, name: 'A' },
      message: 'נפלתי',
      location: { position: location.position, accuracy: 12 },
      closedAt: null,
      closedBy: null,
    });
    expect(new Date(sos.location?.recordedAt ?? '').getTime()).toBe(new Date(location.recordedAt).getTime());
    expect(await list()).toEqual([sos]);
  });

  it('sends it to the sender and the searchers of the sender polygon, and counts them', async () => {
    const sos = Sos.parse((await activate()).json());
    expect(sos.recipientCount).toBe(1);
    const [saved] = savedEvents();
    expect(saved?.event).toMatchObject({ type: 'sos.saved', missionId: mission.id, sos });
    expect([...(saved?.searcherIds ?? [])].sort()).toEqual([sender.searcherId, a1.searcherId].sort());
  });

  it('leaves out searchers who ended their activity', async () => {
    const ended = await signInSearcher(ctx);
    await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 4,
      searcherId: ended.searcherId,
      polygonId: polygonA.id,
      status: 'ended',
    });
    const sos = Sos.parse((await activate()).json());
    expect(sos.recipientCount).toBe(1);
    expect(savedEvents()[0]?.searcherIds).not.toContain(ended.searcherId);
  });

  it('lets the sender close it', async () => {
    const { id } = Sos.parse((await activate()).json());
    const res = await close(id);
    expect(res.statusCode).toBe(200);
    const closed = Sos.parse(res.json());
    expect(closed).toMatchObject({ id, status: 'closed', closedBy: { role: 'searcher', name: 'אלון שגיא' } });
    expect(closed.closedAt).not.toBeNull();
  });

  it('lets the commander close it, and refuses other searchers', async () => {
    const { id } = Sos.parse((await activate()).json());
    for (const other of [a1, b1, available]) {
      const res = await close(id, other);
      expect(res.statusCode).toBe(403);
      expect(ApiError.parse(res.json()).error.code).toBe('FORBIDDEN');
    }
    const res = await close(id, commanderUser);
    expect(res.statusCode).toBe(200);
    expect(Sos.parse(res.json()).closedBy?.role).toBe('commander');
  });

  it('sends the close to the same searchers even after a recipient moved', async () => {
    const { id } = Sos.parse((await activate()).json());
    await ctx.db
      .update(participations)
      .set({ polygonId: polygonB.id })
      .where(eq(participations.searcherId, a1.searcherId));
    await close(id);
    const [activated, closed] = savedEvents();
    expect([...(closed?.searcherIds ?? [])].sort()).toEqual([...(activated?.searcherIds ?? [])].sort());
    expect(closed?.searcherIds).toContain(a1.searcherId);
  });

  it('records one activation on the Timeline and publishes it, and none on close', async () => {
    const sos = Sos.parse((await activate(sender, { message: 'עזרה', location })).json());
    await close(sos.id);
    const timeline = TimelineEventList.parse((await commander({ method: 'GET', url: `/api/missions/${mission.id}/timeline` })).json());
    const events = timeline.filter((e) => e.type === 'sos.activated');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actor: { kind: 'searcher', callsign: 7 },
      subject: { kind: 'sos', id: sos.id, label: 'A' },
      details: { message: 'עזרה' },
    });
    expect(timeline.filter((e) => e.subject.id === sos.id)).toHaveLength(1);
    expect(published.filter((p) => p.event.type === 'timeline.recorded')).toHaveLength(1);
  });

  it('answers 401 without a session', async () => {
    const id = UNKNOWN_ID;
    const anonymous = [
      await ctx.app.inject({ method: 'POST', url: url(), payload: {} }),
      await ctx.app.inject({ method: 'POST', url: url(`/${id}/close`) }),
      await ctx.app.inject({ method: 'GET', url: url() }),
    ];
    expect(anonymous.map((r) => r.statusCode)).toEqual([401, 401, 401]);
  });

  it('refuses the commander to activate', async () => {
    expect((await activate(commanderUser)).statusCode).toBe(403);
  });

  it('does not show the mission to searchers outside it or to another commander', async () => {
    const { id } = Sos.parse((await activate()).json());
    const outsider = await signInSearcher(ctx);
    const otherCommander = await signInCommander(ctx);
    for (const user of [outsider, otherCommander]) {
      const as = injectAs(ctx, user);
      expect((await as({ method: 'GET', url: url() })).statusCode).toBe(404);
      expect((await close(id, user)).statusCode).toBe(404);
    }
    expect((await activate(outsider)).statusCode).toBe(404);
  });

  it('refuses a searcher without a profile', async () => {
    const noProfile = await signInByPhone(ctx);
    expect((await activate(noProfile)).statusCode).toBe(403);
  });

  it('refuses a searcher whose activity ended, and saves nothing', async () => {
    await ctx.db.update(participations).set({ status: 'ended' }).where(eq(participations.id, senderParticipationId));
    const res = await activate();
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(res.json()).error.code).toBe('PARTICIPATION_ENDED');
    expect(await ctx.db.select().from(sosAlerts)).toEqual([]);
    expect(published).toEqual([]);
  });

  it('works in a paused or ended mission while the activity goes on', async () => {
    await setMission('paused');
    expect((await activate()).statusCode).toBe(201);
    await ctx.db.delete(sosAlerts);
    await setMission('ended_stopped');
    const res = await activate();
    expect(res.statusCode).toBe(201);
    const { id } = Sos.parse(res.json());
    expect((await close(id, commanderUser)).statusCode).toBe(200);
    expect(await list()).toHaveLength(1);
  });

  it('returns the active SOS when it is activated again, with no new event', async () => {
    const first = Sos.parse((await activate(sender, { message: 'ראשון', location })).json());
    const res = await activate(sender, { message: 'שני', location });
    expect(res.statusCode).toBe(200);
    expect(Sos.parse(res.json())).toEqual(first);
    expect(await ctx.db.select().from(sosAlerts)).toHaveLength(1);
    expect(savedEvents()).toHaveLength(1);
    const timeline = TimelineEventList.parse((await commander({ method: 'GET', url: `/api/missions/${mission.id}/timeline` })).json());
    expect(timeline.filter((e) => e.type === 'sos.activated')).toHaveLength(1);

    await close(first.id);
    const again = await activate();
    expect(again.statusCode).toBe(201);
    expect(Sos.parse(again.json()).id).not.toBe(first.id);
  });

  it('keeps one active SOS when activated twice at once', async () => {
    const results = await Promise.all([activate(), activate()]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    expect(new Set(results.map((r) => Sos.parse(r.json()).id)).size).toBe(1);
    expect(await ctx.db.select().from(sosAlerts)).toHaveLength(1);
    expect(savedEvents()).toHaveLength(1);
  });

  it('keeps the first closer when closed twice', async () => {
    const { id } = Sos.parse((await activate()).json());
    const first = Sos.parse((await close(id)).json());
    const second = await close(id, sender);
    expect(second.statusCode).toBe(200);
    expect(Sos.parse(second.json())).toEqual(first);
    expect((await close(id, commanderUser)).statusCode).toBe(200);
    expect(Sos.parse((await close(id, commanderUser)).json()).closedBy?.role).toBe('searcher');
    expect(savedEvents()).toHaveLength(2);
    expect((await close(id, a1)).statusCode).toBe(403);
  });

  it('lets a searcher with no polygon activate, sending only to the commander', async () => {
    const res = await activate(available, { location });
    expect(res.statusCode).toBe(201);
    const sos = Sos.parse(res.json());
    expect(sos).toMatchObject({ polygon: null, recipientCount: 0 });
    expect(savedEvents()[0]?.searcherIds).toEqual([available.searcherId]);
    const timeline = TimelineEventList.parse((await commander({ method: 'GET', url: `/api/missions/${mission.id}/timeline` })).json());
    expect(timeline.find((e) => e.type === 'sos.activated')?.subject.label).toBeNull();
  });

  it('uses the last known position without a location, and none when there is none', async () => {
    const withLast = Sos.parse((await activate(sender, {})).json());
    expect(withLast.location).toMatchObject({ position: { type: 'Point', coordinates: [35.128, 31.775] }, accuracy: null });
    const [row] = await ctx.db.select().from(participations).where(eq(participations.id, senderParticipationId));
    expect(new Date(withLast.location?.recordedAt ?? '').getTime()).toBe(row?.lastPositionAt?.getTime());

    const res = await activate(available, { location: null });
    expect(res.statusCode).toBe(201);
    expect(Sos.parse(res.json()).location).toBeNull();
  });

  it('trims the message and limits its length', async () => {
    expect(Sos.parse((await activate(sender, { message: '   ' })).json()).message).toBeNull();
    await ctx.db.delete(sosAlerts);
    expect(Sos.parse((await activate(sender, {})).json()).message).toBeNull();
    await ctx.db.delete(sosAlerts);
    expect((await activate(sender, { message: 'א'.repeat(SOS_MESSAGE_MAX_LENGTH) })).statusCode).toBe(201);
    await ctx.db.delete(sosAlerts);
    const res = await activate(sender, { message: 'א'.repeat(SOS_MESSAGE_MAX_LENGTH + 1) });
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.json())).toContain('message');
  });

  it('refuses bad input and unknown SOS', async () => {
    expect((await close('not-a-uuid')).statusCode).toBe(400);
    expect((await close(UNKNOWN_ID)).statusCode).toBe(404);
    expect((await close(UNKNOWN_ID, commanderUser)).statusCode).toBe(404);

    const { id } = Sos.parse((await activate()).json());
    const other = Mission.parse(
      (
        await commander({
          method: 'POST',
          url: '/api/missions',
          payload: {
            name: 'אחר',
            rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
            lkp: { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' },
          },
        })
      ).json(),
    );
    const res = await commander({ method: 'POST', url: `/api/missions/${other.id}/sos/${id}/close` });
    expect(res.statusCode).toBe(404);
    expect(ApiError.parse(res.json()).error.code).toBe('NOT_FOUND');

    await ctx.db.delete(sosAlerts);
    expect((await activate(sender, { location: { ...location, recordedAt: '2026-10-03T14:22:00' } })).statusCode).toBe(400);
    const badPoint = { ...location, position: { type: 'LineString', coordinates: [[0, 0]] } };
    expect((await activate(sender, { location: badPoint })).statusCode).toBe(400);
  });

  it('shows each user the SOS they may see, newest first', async () => {
    const first = Sos.parse((await activate(sender)).json());
    await close(first.id);
    const second = Sos.parse((await activate(sender)).json());
    const third = Sos.parse((await activate(b1)).json());

    const all = await list(commanderUser);
    expect(all).toHaveLength(3);
    const times = all.map((s) => new Date(s.activatedAt).getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect((await list(sender)).map((s) => s.id).sort()).toEqual([first.id, second.id].sort());
    expect((await list(a1)).map((s) => s.id).sort()).toEqual([first.id, second.id].sort());
    expect((await list(b1)).map((s) => s.id)).toEqual([third.id]);
    expect(await list(available)).toEqual([]);

    await setMission('ended_stopped');
    expect(await list(commanderUser)).toHaveLength(3);
  });
});
