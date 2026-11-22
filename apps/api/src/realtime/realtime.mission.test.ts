import { Mission, MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { missions } from '../db/schema';
import { addParticipant, injectAs, PNG_BYTES, signInCommander, signInSearcher, type TestUser } from '../testing';
import { type Client, setupRealtime } from './fixtures';

describe('realtime', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, record, settle, nextEvent, createMissionAs } = rt;

  describe('rally point', () => {
    const moved = { type: 'Point', coordinates: [35.15, 31.8] };
    const changeAs = (user: TestUser, missionId: string, point: unknown = moved) =>
      injectAs(
        rt.ctx,
        user,
      )({ method: 'PUT', url: `/api/missions/${missionId}/rally-point`, payload: { rallyPoint: point as object } });

    it('reaches the commander and every joined searcher, and nobody of another mission', async () => {
      const commander = await signInCommander(rt.ctx);
      const otherCommander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const joined = await signInSearcher(rt.ctx);
      const notJoined = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: joined.searcherId });
      await addParticipant(rt.ctx.db, { missionId: otherMission.id, callsign: 1, searcherId: notJoined.searcherId });

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
      const commander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });
      const events = record(socket);

      expect((await changeAs(commander, mission.id, { type: 'Point', coordinates: [35, 91] })).statusCode).toBe(400);
      await rt.ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, mission.id));
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
      injectAs(rt.ctx, user)({ method: 'PUT', url: `/api/missions/${missionId}/details`, payload: payload as object });

    it('reaches the commander and every joined searcher, and nobody of another mission', async () => {
      const commander = await signInCommander(rt.ctx);
      const otherCommander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const joined = await signInSearcher(rt.ctx);
      const notJoined = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: joined.searcherId });
      await addParticipant(rt.ctx.db, { missionId: otherMission.id, callsign: 1, searcherId: notJoined.searcherId });

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

    describe('when the commander notifies the searchers', () => {
      const flagged = { ...details, notifySearchers: true };

      async function setup() {
        const commander = await signInCommander(rt.ctx);
        const mission = await createMissionAs(commander);
        const searcher = await signInSearcher(rt.ctx);
        await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 1, searcherId: searcher.searcherId });
        const [commanderSocket, searcherSocket] = [commander, searcher].map(socketFor) as [Client, Client];
        await Promise.all([connect(commanderSocket), connect(searcherSocket)]);
        expect(await join(commanderSocket, mission.id)).toEqual({ ok: true });
        expect(await join(searcherSocket, mission.id)).toEqual({ ok: true });
        return { commander, mission, toCommander: record(commanderSocket), toSearcher: record(searcherSocket) };
      }
      const types = (events: unknown[]) => events.map((event) => MissionEvent.parse(event).type);

      it('sends the commander the Timeline event after the update, and the searchers only the update', async () => {
        const { commander, mission, toCommander, toSearcher } = await setup();
        expect((await editAs(commander, mission.id, flagged)).statusCode).toBe(200);
        await settle();
        expect(types(toCommander)).toEqual(['mission.updated', 'timeline.recorded']);
        const recorded = MissionEvent.parse(toCommander[1]);
        expect(recorded.type === 'timeline.recorded' && recorded.event.type).toBe('mission.details_changed');
        expect(types(toSearcher)).toEqual(['mission.updated']);
      });

      it('sends only the update without the flag', async () => {
        const { commander, mission, toCommander } = await setup();
        expect((await editAs(commander, mission.id)).statusCode).toBe(200);
        await settle();
        expect(types(toCommander)).toEqual(['mission.updated']);
      });
    });

    it('sends nothing when the edit is rejected', async () => {
      const commander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });
      const events = record(socket);

      expect((await editAs(commander, mission.id, { ...details, name: ' ' })).statusCode).toBe(400);
      await rt.ctx.db.update(missions).set({ status: 'ended_stopped' }).where(eq(missions.id, mission.id));
      expect((await editAs(commander, mission.id)).statusCode).toBe(409);
      await settle();
      expect(events).toEqual([]);
    });

    it('sends the new photo address when the photo is replaced', async () => {
      const commander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const socket = socketFor(commander);
      await connect(socket);
      expect(await join(socket, mission.id)).toEqual({ ok: true });

      const event = nextEvent(socket);
      const res = await injectAs(
        rt.ctx,
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
});
