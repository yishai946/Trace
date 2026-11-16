import type { MissionEvent } from '@trace/schemas';
import { MissionPolygon, Sos } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { addParticipant, injectAs, signInCommander, signInSearcher } from '../testing';
import { setupRealtime } from './fixtures';

describe('realtime', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, record, settle, createMissionAs, createPolygonAs } = rt;

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
      const commander = await signInCommander(rt.ctx);
      const otherCommander = await signInCommander(rt.ctx);
      const mission = await createMissionAs(commander);
      const otherMission = await createMissionAs(otherCommander);
      const polygonA = await createPolygonAs(commander, mission.id);
      const resB = await injectAs(
        rt.ctx,
        commander,
      )({ method: 'POST', url: `/api/missions/${mission.id}/polygons`, payload: { geometry: farArea } });
      const polygonB = MissionPolygon.parse(resB.json());
      const sender = await signInSearcher(rt.ctx);
      const a1 = await signInSearcher(rt.ctx);
      const b1 = await signInSearcher(rt.ctx);
      const waiting = await signInSearcher(rt.ctx);
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 1,
        searcherId: sender.searcherId,
        polygonId: polygonA.id,
      });
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 2,
        searcherId: a1.searcherId,
        polygonId: polygonA.id,
      });
      await addParticipant(rt.ctx.db, {
        missionId: mission.id,
        callsign: 3,
        searcherId: b1.searcherId,
        polygonId: polygonB.id,
      });
      await addParticipant(rt.ctx.db, { missionId: mission.id, callsign: 4, searcherId: waiting.searcherId });
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
        rt.ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      expect(res.statusCode).toBe(201);
      const sos = Sos.parse(res.json());
      await settle();
      const activated = { type: 'sos.saved', missionId: mission.id, sos };
      for (const key of ['commander', 'sender', 'a1'] as const) expect(sosEvents(recorded[key])).toEqual([activated]);

      const closed = await injectAs(
        rt.ctx,
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
        rt.ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      expect(first.statusCode).toBe(201);
      await settle();
      const events = record(sockets.commander);
      const again = await injectAs(
        rt.ctx,
        users.sender,
      )({ method: 'POST', url: `/api/missions/${mission.id}/sos`, payload: {} });
      const refused = await injectAs(
        rt.ctx,
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
});
