import {
  LkpDecisionResult,
  Mission,
  Message,
  MissionEvent,
  MissionPolygon,
  REALTIME_PATH,
  Report,
  Sighting,
  Sos,
  type ClientToServerEvents,
  type JoinMissionAck,
  type ServerToClientEvents,
  ParticipantList,
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

    // Positions are the commander's alone (decision 32): not even the searcher who moved gets them back.
    expect(toCommander).toEqual([move1, move2]);
    expect(to1).toEqual([]);
    expect(to2).toEqual([]);

    // An assignment goes the same way: to the commander and the searcher it concerns (UC-C09).
    const list = await ctx.app.inject({
      method: 'GET',
      url: `/api/missions/${mission.id}/participants`,
      headers: commander.headers,
    });
    const participant = ParticipantList.parse(list.json()).find((p) => p.id === participant1);
    if (!participant) throw new Error('participant not listed');
    for (const events of [toCommander, to1, to2]) events.length = 0;
    const updated: MissionEvent = { type: 'participant.updated', missionId: mission.id, participant };
    ctx.realtime.publish(updated);
    await settle();

    expect(toCommander).toEqual([updated]);
    expect(to1).toEqual([updated]);
    expect(to2).toEqual([]);
  });

  it('sends positions and new route points of an upload to the mission commander only', async () => {
    const commander = await signInCommander(ctx);
    const otherCommander = await signInCommander(ctx);
    const mission = await createMissionAs(commander);
    const otherMission = await createMissionAs(otherCommander);
    const searcher1 = await signInSearcher(ctx);
    const searcher2 = await signInSearcher(ctx);
    const participant1 = await addParticipant(ctx.db, {
      missionId: mission.id,
      callsign: 1,
      searcherId: searcher1.searcherId,
    });
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 2, searcherId: searcher2.searcherId });

    const sockets = [commander, searcher1, searcher2, otherCommander].map(socketFor) as [
      Client,
      Client,
      Client,
      Client,
    ];
    await Promise.all(sockets.map(connect));
    expect(await join(sockets[0], mission.id)).toEqual({ ok: true });
    expect(await join(sockets[1], mission.id)).toEqual({ ok: true });
    expect(await join(sockets[2], mission.id)).toEqual({ ok: true });
    expect(await join(sockets[3], otherMission.id)).toEqual({ ok: true });
    const [toCommander, to1, to2, toOther] = sockets.map(record) as [
      MissionEvent[],
      MissionEvent[],
      MissionEvent[],
      MissionEvent[],
    ];

    const upload = (points: object[]) =>
      injectAs(
        ctx,
        searcher1,
      )({ method: 'POST', url: `/api/missions/${mission.id}/track-points`, payload: { points } });
    const fix = { position: [35.13, 31.78], recordedAt: '2026-10-03T13:01:00+03:00', context: 'search' };
    expect((await upload([fix])).statusCode).toBe(200);
    await settle();

    expect(toCommander.map((e) => e.type)).toEqual(['participant.moved', 'participant.tracked']);
    expect(toCommander[1]).toEqual({
      type: 'participant.tracked',
      missionId: mission.id,
      participantId: participant1,
      points: [
        {
          position: [35.13, 31.78],
          recordedAt: new Date(fix.recordedAt).toISOString(),
          accuracy: null,
          context: 'search',
        },
      ],
    });
    expect(to1).toEqual([]);
    expect(to2).toEqual([]);
    expect(toOther).toEqual([]);

    // The same batch again stores nothing new, so there is nothing new to tell.
    toCommander.length = 0;
    expect((await upload([fix])).statusCode).toBe(200);
    await settle();
    expect(toCommander).toEqual([]);
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

  it('sends a sighting a searcher reports to the commander only, once per id', async () => {
    const commander = await signInCommander(ctx);
    const reporter = await signInSearcher(ctx);
    const other = await signInSearcher(ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: reporter.searcherId });
    await addParticipant(ctx.db, { missionId: mission.id, callsign: 2, searcherId: other.searcherId });

    const sockets = [socketFor(commander), socketFor(reporter), socketFor(other)] as const;
    await Promise.all(sockets.map(connect));
    for (const socket of sockets) expect(await join(socket, mission.id)).toEqual({ ok: true });
    const [toCommander, toReporter, toOther] = sockets.map(record) as [MissionEvent[], MissionEvent[], MissionEvent[]];

    const payload = {
      id: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d',
      position: { type: 'Point', coordinates: [35.14, 31.77] },
      observedAt: '2026-10-03T14:22:00+03:00',
      source: 'self',
    };
    const send = () =>
      injectAs(ctx, reporter)({ method: 'POST', url: `/api/missions/${mission.id}/sightings`, payload });
    const first = await send();
    expect(first.statusCode).toBe(201);
    await settle();
    const sighting = Sighting.parse(first.json());
    expect(toCommander).toEqual([{ type: 'sighting.saved', missionId: mission.id, sighting }]);
    expect(sighting.reportedBy.role).toBe('searcher');
    expect(toReporter).toEqual([]);
    expect(toOther).toEqual([]);

    expect((await send()).statusCode).toBe(200);
    await settle();
    expect(toCommander).toHaveLength(1);
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

  describe('SOS', () => {
    const farArea = {
      type: 'Polygon',
      coordinates: [
        [
          [35.15, 31.77],
          [35.16, 31.77],
          [35.16, 31.78],
          [35.15, 31.78],
          [35.15, 31.77],
        ],
      ],
    };

    const setup = async () => {
      const commander = await signInCommander(ctx);
      const otherCommander = await signInCommander(ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const polygonA = await createPolygonAs(commander, mission.id);
      const resB = await injectAs(
        ctx,
        commander,
      )({ method: 'POST', url: `/api/missions/${mission.id}/polygons`, payload: { geometry: farArea } });
      const polygonB = MissionPolygon.parse(resB.json());
      const sender = await signInSearcher(ctx);
      const a1 = await signInSearcher(ctx);
      const b1 = await signInSearcher(ctx);
      const waiting = await signInSearcher(ctx);
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 1,
        searcherId: sender.searcherId,
        polygonId: polygonA.id,
      });
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 2,
        searcherId: a1.searcherId,
        polygonId: polygonA.id,
      });
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 3,
        searcherId: b1.searcherId,
        polygonId: polygonB.id,
      });
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 4, searcherId: waiting.searcherId });
      const users = { sender, a1, b1, waiting };
      const sockets = {
        commander: socketFor(commander),
        sender: socketFor(sender),
        a1: socketFor(a1),
        b1: socketFor(b1),
        waiting: socketFor(waiting),
        otherCommander: socketFor(otherCommander),
      };
      await Promise.all(Object.values(sockets).map(connect));
      for (const key of ['commander', 'sender', 'a1', 'b1', 'waiting'] as const) {
        expect(await join(sockets[key], mission.id)).toEqual({ ok: true });
      }
      expect(await join(sockets.otherCommander, otherMission.id)).toEqual({ ok: true });
      return { commander, mission, users, sockets };
    };

    const sosEvents = (events: MissionEvent[]) => events.filter((e) => e.type === 'sos.saved');

    it('reaches the commander, the sender and the polygon, on activation and on close', async () => {
      const { commander, mission, users, sockets } = await setup();
      const recorded = {
        commander: record(sockets.commander),
        sender: record(sockets.sender),
        a1: record(sockets.a1),
        b1: record(sockets.b1),
        waiting: record(sockets.waiting),
        otherCommander: record(sockets.otherCommander),
      };

      const res = await injectAs(
        ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      expect(res.statusCode).toBe(201);
      const sos = Sos.parse(res.json());
      await settle();
      const activated = { type: 'sos.saved', missionId: mission.id, sos };
      for (const key of ['commander', 'sender', 'a1'] as const) expect(sosEvents(recorded[key])).toEqual([activated]);

      const closed = await injectAs(
        ctx,
        commander,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos/${sos.id}/close` });
      expect(closed.statusCode).toBe(200);
      await settle();
      const closedSos = Sos.parse(closed.json());
      for (const key of ['commander', 'sender', 'a1'] as const) {
        expect(sosEvents(recorded[key])).toEqual([
          activated,
          { type: 'sos.saved', missionId: mission.id, sos: closedSos },
        ]);
      }
      for (const key of ['b1', 'waiting', 'otherCommander'] as const) expect(sosEvents(recorded[key])).toEqual([]);
    });

    it('sends nothing for a refused or a repeated activation', async () => {
      const { mission, users, sockets } = await setup();
      const first = await injectAs(
        ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      expect(first.statusCode).toBe(201);
      await settle();
      const events = record(sockets.commander);
      const again = await injectAs(
        ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      const refused = await injectAs(
        ctx,
        users.sender,
      )({
        method: 'POST',
        url: `/api/missions/${mission.id}/sos`,
        payload: { message: 'x'.repeat(501) },
      });
      expect([again.statusCode, refused.statusCode]).toEqual([200, 400]);
      await settle();
      expect(events).toEqual([]);
    });
  });

  describe('messages', () => {
    const sendAs = async (user: TestUser, missionId: string, payload: object) => {
      const res = await injectAs(ctx, user)({ method: 'POST', url: `/api/missions/${missionId}/messages`, payload });
      expect(res.statusCode).toBe(201);
      return Message.parse(res.json());
    };
    const receiptAs = (user: TestUser, missionId: string, messageId: string, receipt: string) =>
      injectAs(
        ctx,
        user,
      )({
        method: 'PUT',
        url: `/api/missions/${missionId}/participation/messages/${messageId}/receipt`,
        payload: { receipt },
      });

    it('R1: sends the commander the whole message and each recipient only their own copy', async () => {
      const commander = await signInCommander(ctx);
      const otherCommander = await signInCommander(ctx);
      const a = await signInSearcher(ctx);
      const b = await signInSearcher(ctx);
      const mission = await createMissionAs(commander);
      const polygonA = await createPolygonAs(commander, mission.id);
      const polygonB = await createPolygonAs(commander, mission.id);
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 1,
        polygonId: polygonA.id,
        searcherId: a.searcherId,
      });
      await addParticipant(ctx.db, {
        missionId: mission.id,
        callsign: 2,
        polygonId: polygonB.id,
        searcherId: b.searcherId,
      });
      const otherMission = await createMissionAs(otherCommander);

      const [sc, sa, sb, so] = [commander, a, b, otherCommander].map(socketFor) as [Client, Client, Client, Client];
      await Promise.all([sc, sa, sb, so].map(connect));
      await join(sc, mission.id);
      await join(sa, mission.id);
      await join(sb, mission.id);
      await join(so, otherMission.id);
      const toCommander = record(sc);
      const toA = record(sa);
      const toB = record(sb);
      const toOther = record(so);

      const message = await sendAs(commander, mission.id, {
        target: { kind: 'polygons', polygonIds: [polygonA.id] },
        urgency: 'normal',
        body: 'חזרו לכינוס',
      });
      await settle();

      expect(toCommander).toEqual([{ type: 'message.sent', missionId: mission.id, message }]);
      expect(toA).toHaveLength(1);
      const received = toA[0];
      if (received?.type !== 'message.received') throw new Error('Expected message.received');
      expect(received.searcherId).toBe(a.searcherId);
      expect(received.message.status).toBe('sent');
      expect('recipients' in received.message).toBe(false);
      expect(toB).toEqual([]);
      expect(toOther).toEqual([]);
    });

    it('R2: sends a receipt to the commander only, once', async () => {
      const commander = await signInCommander(ctx);
      const a = await signInSearcher(ctx);
      const mission = await createMissionAs(commander);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: a.searcherId });
      const message = await sendAs(commander, mission.id, {
        target: { kind: 'mission' },
        urgency: 'normal',
        body: 'שלום',
      });

      const [sc, sa] = [commander, a].map(socketFor) as [Client, Client];
      await Promise.all([sc, sa].map(connect));
      await join(sc, mission.id);
      await join(sa, mission.id);
      const toCommander = record(sc);
      const toA = record(sa);

      expect((await receiptAs(a, mission.id, message.id, 'read')).statusCode).toBe(200);
      await settle();
      expect(toCommander).toHaveLength(1);
      expect(toCommander[0]).toMatchObject({
        type: 'message.receipt',
        messageId: message.id,
        recipient: { status: 'read' },
      });
      expect(toA).toEqual([]);

      await receiptAs(a, mission.id, message.id, 'read');
      await settle();
      expect(toCommander).toHaveLength(1);
    });

    it('R3: a searcher who was offline reads the message after reconnecting and the commander sees the receipts', async () => {
      const commander = await signInCommander(ctx);
      const a = await signInSearcher(ctx);
      const mission = await createMissionAs(commander);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: a.searcherId });
      const sc = socketFor(commander);
      await connect(sc);
      await join(sc, mission.id);
      const toCommander = record(sc);

      // Sent while the searcher has no socket.
      const message = await sendAs(commander, mission.id, {
        target: { kind: 'mission' },
        urgency: 'important',
        body: 'שלום',
      });

      const sa = socketFor(a);
      await connect(sa);
      await join(sa, mission.id);
      const inbox = await injectAs(
        ctx,
        a,
      )({ method: 'GET', url: `/api/missions/${mission.id}/participation/messages` });
      expect(inbox.json()).toEqual([expect.objectContaining({ id: message.id, deliveredAt: null })]);

      await receiptAs(a, mission.id, message.id, 'delivered');
      await settle();
      const delivered = toCommander.find((e) => e.type === 'message.receipt');
      expect(delivered).toMatchObject({ recipient: { status: 'sent' } });
      if (delivered?.type !== 'message.receipt') throw new Error('Expected message.receipt');
      expect(delivered.recipient.deliveredAt).not.toBeNull();

      await receiptAs(a, mission.id, message.id, 'read');
      await settle();
      const receipts = toCommander.filter((e) => e.type === 'message.receipt');
      expect(receipts).toHaveLength(2);
      expect(receipts[1]).toMatchObject({ recipient: { status: 'read' } });
    });
  });

  describe('reports', () => {
    const REPORT_ID = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0e';
    const report = {
      id: REPORT_ID,
      type: 'hazard',
      text: 'מדרון חלק',
      position: { type: 'Point', coordinates: [35.131, 31.775] },
      reportedAt: '2026-10-03T13:20:00+03:00',
    };

    const setup = async () => {
      const commander = await signInCommander(ctx);
      const reporter = await signInSearcher(ctx);
      const other = await signInSearcher(ctx);
      const mission = await createMissionAs(commander);
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 1, searcherId: reporter.searcherId });
      await addParticipant(ctx.db, { missionId: mission.id, callsign: 2, searcherId: other.searcherId });
      const sockets = [socketFor(commander), socketFor(reporter), socketFor(other)] as const;
      await Promise.all(sockets.map(connect));
      for (const socket of sockets) expect(await join(socket, mission.id)).toEqual({ ok: true });
      const [toCommander, toReporter, toOther] = sockets.map(record) as [
        MissionEvent[],
        MissionEvent[],
        MissionEvent[],
      ];
      return { commander, reporter, other, mission, toCommander, toReporter, toOther };
    };
    const reportEvents = (events: MissionEvent[]) => events.filter((e) => e.type.startsWith('report.'));

    it('R1: sends a report a searcher sends to the commander only, once per id', async () => {
      const { reporter, mission, toCommander, toReporter, toOther } = await setup();
      const send = () =>
        injectAs(ctx, reporter)({ method: 'POST', url: `/api/missions/${mission.id}/reports`, payload: report });
      const first = await send();
      expect(first.statusCode).toBe(201);
      await settle();
      expect(reportEvents(toCommander)).toEqual([
        { type: 'report.saved', missionId: mission.id, report: Report.parse(first.json()) },
      ]);
      expect(toCommander.some((e) => e.type === 'timeline.recorded')).toBe(true);
      expect(reportEvents(toReporter)).toEqual([]);
      expect(reportEvents(toOther)).toEqual([]);

      expect((await send()).statusCode).toBe(200);
      await settle();
      expect(reportEvents(toCommander)).toHaveLength(1);
    });

    it('R2: sends handling and deletion to the commander only, and nothing for a refused handling', async () => {
      const { commander, reporter, mission, toCommander, toReporter, toOther } = await setup();
      await injectAs(ctx, reporter)({ method: 'POST', url: `/api/missions/${mission.id}/reports`, payload: report });
      await settle();
      toCommander.length = 0;

      const refused = await injectAs(
        ctx,
        reporter,
      )({ method: 'POST', url: `/api/missions/${mission.id}/reports/${REPORT_ID}/handle` });
      expect(refused.statusCode).toBe(403);
      await settle();
      expect(reportEvents(toCommander)).toEqual([]);

      const handled = await injectAs(
        ctx,
        commander,
      )({ method: 'POST', url: `/api/missions/${mission.id}/reports/${REPORT_ID}/handle` });
      expect(handled.statusCode).toBe(200);
      const deleted = await injectAs(
        ctx,
        commander,
      )({ method: 'DELETE', url: `/api/missions/${mission.id}/reports/${REPORT_ID}` });
      expect(deleted.statusCode).toBe(204);
      await settle();
      expect(reportEvents(toCommander)).toEqual([
        { type: 'report.saved', missionId: mission.id, report: Report.parse(handled.json()) },
        { type: 'report.deleted', missionId: mission.id, reportId: REPORT_ID },
      ]);
      expect(reportEvents(toReporter)).toEqual([]);
      expect(reportEvents(toOther)).toEqual([]);
    });
  });
});
