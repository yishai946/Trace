import {
  LkpDecisionResult,
  Mission,
  MissionEvent,
  MissionPolygon,
  REALTIME_PATH,
  Sighting,
  type ClientToServerEvents,
  type JoinMissionAck,
  type ServerToClientEvents,
} from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { missions } from '../db/schema';
import {
  addParticipant,
  createTestApp,
  injectAs,
  PNG_BYTES,
  resetDb,
  signInCommander,
  signInSearcher,
  type TestContext,
  type TestUser,
} from '../testing';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const rallyPoint = { type: 'Point', coordinates: [35.13, 31.78] };
const lkp = { position: { type: 'Point', coordinates: [35.137, 31.769] }, observedAt: '2026-10-03T13:05:00+03:00' };
const area = {
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

/** Time to wait before concluding that an event will not arrive. */
const QUIET_MS = 300;

describe('realtime', () => {
  let ctx: TestContext;
  let url: string;
  const clients: Client[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    url = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  });
  beforeEach(() => resetDb(ctx.db));
  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });
  afterAll(() => ctx.close());

  /** A socket that signs in the way the user's app does: Command with the cookie, Field with `auth.token`. */
  const socketFor = (user: TestUser | null): Client => {
    const bearer = user?.headers.authorization?.replace(/^Bearer /, '');
    const client: Client = io(url, {
      path: REALTIME_PATH,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: user?.headers.cookie ? { cookie: user.headers.cookie } : {},
      auth: bearer ? { token: bearer } : {},
    });
    clients.push(client);
    return client;
  };

  const connect = (client: Client) =>
    new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });

  const join = (client: Client, missionId: string) =>
    new Promise<JoinMissionAck>((resolve) => client.emit('mission:join', { missionId }, resolve));

  /** Collects every mission event the client receives from now on. */
  const record = (client: Client) => {
    const events: MissionEvent[] = [];
    client.on('mission:event', (event) => events.push(event));
    return events;
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, QUIET_MS));

  const nextEvent = (client: Client) => new Promise<MissionEvent>((resolve) => client.once('mission:event', resolve));

  const createMissionAs = async (user: TestUser) => {
    const res = await injectAs(
      ctx,
      user,
    )({ method: 'POST', url: '/api/missions', payload: { name: 'מסע', rallyPoint, lkp } });
    expect(res.statusCode).toBe(201);
    return Mission.parse(res.json());
  };

  const createPolygonAs = async (user: TestUser, missionId: string) => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${missionId}/polygons`,
      payload: { geometry: area },
    });
    expect(res.statusCode).toBe(201);
    return MissionPolygon.parse(res.json());
  };

  const createSightingAs = async (user: TestUser, missionId: string) => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'POST',
      url: `/api/missions/${missionId}/sightings`,
      payload: {
        position: { type: 'Point', coordinates: [35.14, 31.77] },
        observedAt: '2026-10-03T14:22:00+03:00',
        source: 'witness',
      },
    });
    expect(res.statusCode).toBe(201);
    return Sighting.parse(res.json());
  };

  const decideAs = async (user: TestUser, missionId: string, sightingId: string, decision: 'accepted' | 'rejected') => {
    const res = await injectAs(
      ctx,
      user,
    )({
      method: 'PUT',
      url: `/api/missions/${missionId}/sightings/${sightingId}/lkp-decision`,
      payload: { decision },
    });
    expect(res.statusCode).toBe(200);
    return LkpDecisionResult.parse(res.json());
  };

  it('rejects a connection without a session, or with a forged token', async () => {
    await expect(connect(socketFor(null))).rejects.toThrow('UNAUTHENTICATED');
    const forged = { userId: 'x', headers: { authorization: 'Bearer forged-token' } };
    await expect(connect(socketFor(forged))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('closes the connection when the user signs out elsewhere', async () => {
    const commander = await signInCommander(ctx);
    const socket = socketFor(commander);
    await connect(socket);
    const closed = new Promise<string>((resolve) => socket.once('disconnect', resolve));
    const res = await injectAs(ctx, commander)({ method: 'POST', url: '/api/auth/sign-out', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(await closed).toBe('io server disconnect');
  });

  it("does not let a user join another commander's mission, or one a searcher is not part of", async () => {
    const owner = await signInCommander(ctx);
    const other = await signInCommander(ctx);
    const searcher = await signInSearcher(ctx);
    const mission = await createMissionAs(owner);

    const otherSocket = socketFor(other);
    const searcherSocket = socketFor(searcher);
    await Promise.all([connect(otherSocket), connect(searcherSocket)]);
    expect(await join(otherSocket, mission.id)).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await join(searcherSocket, mission.id)).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await join(otherSocket, 'not-a-uuid' as string)).toEqual({ ok: false, code: 'VALIDATION_ERROR' });

    const events = record(otherSocket);
    await createPolygonAs(owner, mission.id);
    await settle();
    expect(events).toEqual([]);
  });

  it('sends an event in mission A only to those who joined mission A', async () => {
    const commanderA = await signInCommander(ctx);
    const commanderB = await signInCommander(ctx);
    const missionA = await createMissionAs(commanderA);
    const missionB = await createMissionAs(commanderB);
    const searcherA = await signInSearcher(ctx);
    const searcherB = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: missionA.id, callsign: 1, searcherId: searcherA.searcherId });
    await addParticipant(ctx.db, { missionId: missionB.id, callsign: 1, searcherId: searcherB.searcherId });

    const [socketA, socketSearcherA, socketB, socketSearcherB] = [commanderA, searcherA, commanderB, searcherB].map(
      socketFor,
    ) as [Client, Client, Client, Client];
    await Promise.all([socketA, socketSearcherA, socketB, socketSearcherB].map(connect));
    expect(await join(socketA, missionA.id)).toEqual({ ok: true });
    expect(await join(socketSearcherA, missionA.id)).toEqual({ ok: true });
    expect(await join(socketB, missionB.id)).toEqual({ ok: true });
    expect(await join(socketSearcherB, missionB.id)).toEqual({ ok: true });
    const missedB = [...record(socketB), ...record(socketSearcherB)];

    const toCommander = nextEvent(socketA);
    const toSearcher = nextEvent(socketSearcherA);
    const polygon = await createPolygonAs(commanderA, missionA.id);
    const expected = { type: 'polygon.saved', missionId: missionA.id, polygon };
    expect(await toCommander).toEqual(expected);
    expect(await toSearcher).toEqual(expected);

    const deleted = nextEvent(socketSearcherA);
    const res = await injectAs(
      ctx,
      commanderA,
    )({
      method: 'DELETE',
      url: `/api/missions/${missionA.id}/polygons/${polygon.id}`,
    });
    expect(res.statusCode).toBe(204);
    expect(await deleted).toEqual({ type: 'polygon.deleted', missionId: missionA.id, polygonId: polygon.id });

    await settle();
    expect(missedB).toEqual([]);
  });

  describe('rally point', () => {
    const moved = { type: 'Point', coordinates: [35.15, 31.8] };
    const changeAs = (user: TestUser, missionId: string, point: unknown = moved) =>
      injectAs(
        ctx,
        user,
      )({ method: 'PUT', url: `/api/missions/${missionId}/rally-point`, payload: { rallyPoint: point as object } });

    it('reaches the commander and every joined searcher, and nobody of another mission', async () => {
      const commander = await signInCommander(ctx);
      const otherCommander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const joined = await signInSearcher(ctx);
      const notJoined = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: joined.searcherId });
      await addParticipant(ctx.db, { missionId: otherMission.id, callsign: 1, searcherId: notJoined.searcherId });

      const [commanderSocket, joinedSocket, otherSocket, notJoinedSocket] = [
        commander,
        joined,
        otherCommander,
        notJoined,
      ].map(socketFor) as [Client, Client, Client, Client];
      await Promise.all([commanderSocket, joinedSocket, otherSocket, notJoinedSocket].map(connect));
      expect(await join(commanderSocket, mission.id)).toEqual({ ok: true });
      expect(await join(joinedSocket, mission.id)).toEqual({ ok: true });
      expect(await join(otherSocket, otherMission.id)).toEqual({ ok: true });
      const missed = [...record(otherSocket), ...record(notJoinedSocket)];

      const toCommander = nextEvent(commanderSocket);
      const toSearcher = nextEvent(joinedSocket);
      const res = await changeAs(commander, mission.id);
      expect(res.statusCode).toBe(200);
      const expected = {
        type: 'rally.changed',
        missionId: mission.id,
        rallyPoint: moved,
        updatedAt: Mission.parse(res.json()).updatedAt,
      };
      expect(MissionEvent.parse(await toCommander)).toEqual(expected);
      expect(MissionEvent.parse(await toSearcher)).toEqual(expected);

      await settle();
      expect(missed).toEqual([]);
    });

    it('sends nothing when the change is rejected', async () => {
      const commander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });
      const events = record(socket);

      expect((await changeAs(commander, mission.id, { type: 'Point', coordinates: [35, 91] })).statusCode).toBe(400);
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, mission.id));
      expect((await changeAs(commander, mission.id)).statusCode).toBe(409);
      await settle();
      expect(events).toEqual([]);
    });
  });

  describe('mission details', () => {
    const details = {
      name: 'מסע 0413',
      missingPerson: { name: 'נועם אברהם', age: 75, description: 'מעיל חום' },
    };
    const editAs = (user: TestUser, missionId: string, payload: unknown = details) =>
      injectAs(ctx, user)({ method: 'PUT', url: `/api/missions/${missionId}/details`, payload: payload as object });

    it('reaches the commander and every joined searcher, and nobody of another mission', async () => {
      const commander = await signInCommander(ctx);
      const otherCommander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const joined = await signInSearcher(ctx);
      const notJoined = await signInSearcher(ctx);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: joined.searcherId });
      await addParticipant(ctx.db, { missionId: otherMission.id, callsign: 1, searcherId: notJoined.searcherId });

      const [commanderSocket, joinedSocket, otherSocket, notJoinedSocket] = [
        commander,
        joined,
        otherCommander,
        notJoined,
      ].map(socketFor) as [Client, Client, Client, Client];
      await Promise.all([commanderSocket, joinedSocket, otherSocket, notJoinedSocket].map(connect));
      expect(await join(commanderSocket, mission.id)).toEqual({ ok: true });
      expect(await join(joinedSocket, mission.id)).toEqual({ ok: true });
      expect(await join(otherSocket, otherMission.id)).toEqual({ ok: true });
      const missed = [...record(otherSocket), ...record(notJoinedSocket)];

      const toCommander = nextEvent(commanderSocket);
      const toSearcher = nextEvent(joinedSocket);
      const res = await editAs(commander, mission.id);
      expect(res.statusCode).toBe(200);
      const expected = { type: 'mission.updated', missionId: mission.id, mission: Mission.parse(res.json()) };
      expect(MissionEvent.parse(await toCommander)).toEqual(expected);
      expect(MissionEvent.parse(await toSearcher)).toEqual(expected);

      await settle();
      expect(missed).toEqual([]);
    });

    it('sends nothing when the edit is rejected', async () => {
      const commander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });
      const events = record(socket);

      expect((await editAs(commander, mission.id, { ...details, name: ' ' })).statusCode).toBe(400);
      await ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, mission.id));
      expect((await editAs(commander, mission.id)).statusCode).toBe(409);
      await settle();
      expect(events).toEqual([]);
    });

    it('sends the new photo address when the photo is replaced', async () => {
      const commander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });

      const event = nextEvent(socket);
      const res = await injectAs(
        ctx,
        commander,
      )({
        method: 'PUT',
        url: `/api/missions/${mission.id}/photo`,
        payload: PNG_BYTES,
        headers: { 'content-type': 'image/png' },
      });
      expect(res.statusCode).toBe(200);
      const photoUrl = Mission.parse(res.json()).missingPerson.photoUrl;
      expect(photoUrl).not.toBeNull();
      const received = MissionEvent.parse(await event);
      expect(received.type).toBe('mission.updated');
      if (received.type === 'mission.updated') expect(received.mission.missingPerson.photoUrl).toBe(photoUrl);
    });
  });

  it("does not send a searcher other searchers' positions; the commander gets them all", async () => {
    const commander = await signInCommander(ctx);
    const mission = await createMissionAs(commander);
    const searcher1 = await signInSearcher(ctx);
    const searcher2 = await signInSearcher(ctx);
    const participant1 = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 1,
      searcherId: searcher1.searcherId,
    });
    const participant2 = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 2,
      searcherId: searcher2.searcherId,
    });

    const [commanderSocket, socket1, socket2] = [commander, searcher1, searcher2].map(socketFor) as [
      Client,
      Client,
      Client,
    ];
    await Promise.all([commanderSocket, socket1, socket2].map(connect));
    for (const socket of [commanderSocket, socket1, socket2])
      expect(await join(socket, mission.id)).toEqual({ ok: true });
    const [toCommander, to1, to2] = [commanderSocket, socket1, socket2].map(record) as [
      MissionEvent[],
      MissionEvent[],
      MissionEvent[],
    ];

    const moved = (participantId: string, searcherId: string): MissionEvent => ({
      type: 'participant.moved',
      missionId: mission.id,
      participantId,
      searcherId,
      position: [35.13, 31.775],
      positionAt: new Date().toISOString(),
    });
    const move1 = moved(participant1, searcher1.searcherId);
    const move2 = moved(participant2, searcher2.searcherId);
    ctx.realtime.publish(move1);
    ctx.realtime.publish(move2);
    await settle();

    expect(toCommander).toEqual([move1, move2]);
    expect(to1).toEqual([move1]);
    expect(to2).toEqual([move2]);
  });

  it('stops sending events after the client leaves the mission', async () => {
    const commander = await signInCommander(ctx);
    const mission = await createMissionAs(commander);
    const socket = socketFor(commander);
    await connect(socket);
    expect(await join(socket, mission.id)).toEqual({ ok: true });
    const events = record(socket);
    socket.emit('mission:leave', { missionId: mission.id });
    await settle();

    await createPolygonAs(commander, mission.id);
    await settle();
    expect(events).toEqual([]);
  });

  it('sends the new LKP to every member at once, and sightings only to the commander', async () => {
    const commander = await signInCommander(ctx);
    const otherCommander = await signInCommander(ctx);
    const searcher = await signInSearcher(ctx);
    const mission = await createMissionAs(commander);
    const otherMission = await createMissionAs(otherCommander);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });

    const commanderSocket = socketFor(commander);
    const searcherSocket = socketFor(searcher);
    const otherSocket = socketFor(otherCommander);
    await Promise.all([commanderSocket, searcherSocket, otherSocket].map(connect));
    expect(await join(commanderSocket, mission.id)).toEqual({ ok: true });
    expect(await join(searcherSocket, mission.id)).toEqual({ ok: true });
    expect(await join(otherSocket, otherMission.id)).toEqual({ ok: true });
    const [toCommander, toSearcher, toOther] = [commanderSocket, searcherSocket, otherSocket].map(record) as [
      MissionEvent[],
      MissionEvent[],
      MissionEvent[],
    ];

    const sighting = await createSightingAs(commander, mission.id);
    await settle();
    expect(toCommander).toEqual([{ type: 'sighting.saved', missionId: mission.id, sighting }]);

    const result = await decideAs(commander, mission.id, sighting.id, 'accepted');
    await settle();
    expect(toCommander.slice(1)).toEqual([
      { type: 'sighting.saved', missionId: mission.id, sighting: result.sighting },
      { type: 'lkp.changed', missionId: mission.id, lkp: result.lkp },
    ]);
    expect(toSearcher).toEqual([{ type: 'lkp.changed', missionId: mission.id, lkp: result.lkp }]);
    expect(toOther).toEqual([]);
  });

  it('does not announce an LKP change when the suggestion is rejected', async () => {
    const commander = await signInCommander(ctx);
    const searcher = await signInSearcher(ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });
    const searcherSocket = socketFor(searcher);
    await connect(searcherSocket);
    await join(searcherSocket, mission.id);
    const toSearcher = record(searcherSocket);

    const sighting = await createSightingAs(commander, mission.id);
    await decideAs(commander, mission.id, sighting.id, 'rejected');
    await settle();
    expect(toSearcher).toEqual([]);
  });

  it('gives a member who was away the new LKP from the mission after reconnecting', async () => {
    const commander = await signInCommander(ctx);
    const searcher = await signInSearcher(ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });

    const sighting = await createSightingAs(commander, mission.id);
    const result = await decideAs(commander, mission.id, sighting.id, 'accepted');

    // Nothing was delivered while the searcher was away; the mission snapshot carries the LKP (decision 87).
    const res = await injectAs(ctx, searcher)({ method: 'GET', url: `/api/missions/${mission.id}` });
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).lkp).toEqual(result.lkp);
  });

  it("sends the Timeline only to the mission's commander", async () => {
    const commanderA = await signInCommander(ctx);
    const commanderB = await signInCommander(ctx);
    const missionA = await createMissionAs(commanderA);
    const missionB = await createMissionAs(commanderB);
    const searcher = await signInSearcher(ctx);
    await addParticipant(ctx.db, { missionId: missionA.id, callsign: 1, searcherId: searcher.searcherId });

    const [socketA, socketSearcher, socketB] = [commanderA, searcher, commanderB].map(socketFor) as [
      Client,
      Client,
      Client,
    ];
    await Promise.all([socketA, socketSearcher, socketB].map(connect));
    expect(await join(socketA, missionA.id)).toEqual({ ok: true });
    expect(await join(socketSearcher, missionA.id)).toEqual({ ok: true });
    expect(await join(socketB, missionB.id)).toEqual({ ok: true });
    const commanderEvents = record(socketA);
    const searcherEvents = record(socketSearcher);
    const otherEvents = record(socketB);

    const polygon = await createPolygonAs(commanderA, missionA.id);
    await settle();

    expect(commanderEvents.map((e) => e.type)).toEqual(['polygon.saved', 'timeline.recorded']);
    const recorded = commanderEvents.find((e) => e.type === 'timeline.recorded');
    expect(recorded).toMatchObject({
      missionId: missionA.id,
      event: { type: 'polygon.created', subject: { id: polygon.id } },
    });
    expect(searcherEvents.map((e) => e.type)).toEqual(['polygon.saved']);
    expect(otherEvents).toEqual([]);
  });
});
