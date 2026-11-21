import type { MissionEvent } from '@trace/schemas';
import { Mission, Sighting, ParticipantList } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { addParticipant, injectAs, signInCommander, signInSearcher } from '../testing';
import { type Client, setupRealtime } from './fixtures';

describe('realtime', () => {
  const rt = setupRealtime();
  const {
    socketFor,
    connect,
    join,
    record,
    settle,
    nextEvent,
    createMissionAs,
    createPolygonAs,
    createSightingAs,
    decideAs,
  } = rt;

  it('rejects a connection without a session, or with a forged token', async () => {
    await expect(connect(socketFor(null))).rejects.toThrow('UNAUTHENTICATED');
    const forged = { userId: 'x', headers: { authorization: 'Bearer forged-token' } };
    await expect(connect(socketFor(forged))).rejects.toThrow('UNAUTHENTICATED');
  });

  it('closes the connection when the user signs out elsewhere', async () => {
    const commander = await signInCommander(rt.ctx);
    const socket = socketFor(commander);
    await connect(socket);
    const closed = new Promise<string>((resolve) => socket.once('disconnect', resolve));
    const res = await injectAs(rt.ctx, commander)({ method: 'POST', url: '/api/auth/sign-out', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(await closed).toBe('io server disconnect');
  });

  it("does not let a user join another commander's mission, or one a searcher is not part of", async () => {
    const owner = await signInCommander(rt.ctx);
    const other = await signInCommander(rt.ctx);
    const searcher = await signInSearcher(rt.ctx);
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
    const commanderA = await signInCommander(rt.ctx);
    const commanderB = await signInCommander(rt.ctx);
    const missionA = await createMissionAs(commanderA);
    const missionB = await createMissionAs(commanderB);
    const searcherA = await signInSearcher(rt.ctx);
    const searcherB = await signInSearcher(rt.ctx);
    await addParticipant(rt.ctx.db, { missionId: missionA.id, callsign: 1, searcherId: searcherA.searcherId });
    await addParticipant(rt.ctx.db, { missionId: missionB.id, callsign: 1, searcherId: searcherB.searcherId });

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
      rt.ctx,
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

  it("does not send a searcher other searchers' positions; the commander gets them all", async () => {
    const commander = await signInCommander(rt.ctx);
    const mission = await createMissionAs(commander);
    const searcher1 = await signInSearcher(rt.ctx);
    const searcher2 = await signInSearcher(rt.ctx);
    const participant1 = await addParticipant(rt.ctx.db, {
      missionId: mission.id,
      callsign: 1,
      searcherId: searcher1.searcherId,
    });
    const participant2 = await addParticipant(rt.ctx.db, {
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
    rt.ctx.realtime.publish(move1);
    rt.ctx.realtime.publish(move2);
    await settle();

    // Positions are the commander's alone (decision 32): not even the searcher who moved gets them back.
    expect(toCommander).toEqual([move1, move2]);
    expect(to1).toEqual([]);
    expect(to2).toEqual([]);

    // An assignment goes the same way: to the commander and the searcher it concerns (UC-C09).
    const list = await rt.ctx.app.inject({
      method: 'GET',
      url: `/api/missions/${mission.id}/participants`,
      headers: commander.headers,
    });
    const participant = ParticipantList.parse(list.json()).find((p) => p.id === participant1);
    if (!participant) throw new Error('participant not listed');
    for (const events of [toCommander, to1, to2]) events.length = 0;
    const updated: MissionEvent = { type: 'participant.updated', missionId: mission.id, participant };
    rt.ctx.realtime.publish(updated);
    await settle();

    expect(toCommander).toEqual([updated]);
    expect(to1).toEqual([updated]);
    expect(to2).toEqual([]);
  });

  it('sends positions and new route points of an upload to the mission commander only', async () => {
    const commander = await signInCommander(rt.ctx);
    const otherCommander = await signInCommander(rt.ctx);
    const mission = await createMissionAs(commander);
    const otherMission = await createMissionAs(otherCommander);
    const searcher1 = await signInSearcher(rt.ctx);
    const searcher2 = await signInSearcher(rt.ctx);
    const participant1 = await addParticipant(rt.ctx.db, {
      missionId: mission.id,
      callsign: 1,
      searcherId: searcher1.searcherId,
    });
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 2, searcherId: searcher2.searcherId });

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
        rt.ctx,
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
    const commander = await signInCommander(rt.ctx);
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
    const commander = await signInCommander(rt.ctx);
    const otherCommander = await signInCommander(rt.ctx);
    const searcher = await signInSearcher(rt.ctx);
    const mission = await createMissionAs(commander);
    const otherMission = await createMissionAs(otherCommander);
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });

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
    const commander = await signInCommander(rt.ctx);
    const reporter = await signInSearcher(rt.ctx);
    const other = await signInSearcher(rt.ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: reporter.searcherId });
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 2, searcherId: other.searcherId });

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
      injectAs(rt.ctx, reporter)({ method: 'POST', url: `/api/missions/${mission.id}/sightings`, payload });
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
    const commander = await signInCommander(rt.ctx);
    const searcher = await signInSearcher(rt.ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });
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
    const commander = await signInCommander(rt.ctx);
    const searcher = await signInSearcher(rt.ctx);
    const mission = await createMissionAs(commander);
    await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });

    const sighting = await createSightingAs(commander, mission.id);
    const result = await decideAs(commander, mission.id, sighting.id, 'accepted');

    // Nothing was delivered while the searcher was away; the mission snapshot carries the LKP (decision 87).
    const res = await injectAs(rt.ctx, searcher)({ method: 'GET', url: `/api/missions/${mission.id}` });
    expect(res.statusCode).toBe(200);
    expect(Mission.parse(res.json()).lkp).toEqual(result.lkp);
  });

  it("sends the Timeline only to the mission's commander", async () => {
    const commanderA = await signInCommander(rt.ctx);
    const commanderB = await signInCommander(rt.ctx);
    const missionA = await createMissionAs(commanderA);
    const missionB = await createMissionAs(commanderB);
    const searcher = await signInSearcher(rt.ctx);
    await addParticipant(rt.ctx.db, { missionId: missionA.id, callsign: 1, searcherId: searcher.searcherId });

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
