import { OFFLINE_AFTER_MS } from '@trace/domain';
import { ParticipantList, type MissionEvent } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { participations } from '../db/schema';
import { addParticipant, injectAs, signInCommander, signInSearcher } from '../testing';
import { setupRealtime } from './fixtures';

describe('searcher connectivity (UC-C10)', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, recordAll: record, settle, createMissionAs } = rt;

  const setup = async (lastPositionAt: Date | null) => {
    const commander = await signInCommander(rt.ctx);
    const mission = await createMissionAs(commander);
    const searcher = await signInSearcher(rt.ctx);
    const participationId = await addParticipant(rt.ctx.db, {
      missionId: mission.id,
      callsign: 1,
      searcherId: searcher.searcherId,
      position: [35.13, 31.78],
    });
    await rt.ctx.db.update(participations).set({ lastPositionAt }).where(eq(participations.id, participationId));
    const list = async () => {
      const res = await injectAs(rt.ctx, commander)({ method: 'GET', url: `/api/missions/${mission.id}/participants` });
      expect(res.statusCode).toBe(200);
      const [participant] = ParticipantList.parse(res.json());
      if (!participant) throw new Error('No participant');
      return participant;
    };
    return { commander, mission, searcher, participationId, list };
  };

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

  it('is Offline without a live connection and without a recent update', async () => {
    const { list } = await setup(minutesAgo(10));
    const participant = await list();
    expect(participant.offline).toBe(true);
    expect(participant.lastUpdateAt).not.toBeNull();
  });

  it('is Offline with no update at all and no connection', async () => {
    const { list } = await setup(null);
    expect(await list()).toMatchObject({ offline: true, lastUpdateAt: null });
  });

  it('is online without a connection while the last update is within the threshold', async () => {
    const { list } = await setup(new Date(Date.now() - OFFLINE_AFTER_MS + 30_000));
    expect((await list()).offline).toBe(false);
  });

  it('is online while the searcher holds the mission connection, even with an old update', async () => {
    const { list, searcher, mission } = await setup(minutesAgo(10));
    const socket = socketFor(searcher);
    await connect(socket);
    expect(await join(socket, mission.id)).toEqual({ ok: true });
    expect((await list()).offline).toBe(false);
  });

  it('is Offline again once the connection closes', async () => {
    const { list, searcher, mission } = await setup(minutesAgo(10));
    const socket = socketFor(searcher);
    await connect(socket);
    await join(socket, mission.id);
    expect((await list()).offline).toBe(false);
    socket.disconnect();
    await vi.waitFor(async () => expect((await list()).offline).toBe(true));
  });

  it('does not count a connection that did not join the mission', async () => {
    const { list, searcher } = await setup(minutesAgo(10));
    await connect(socketFor(searcher));
    expect((await list()).offline).toBe(true);
  });

  describe('live changes', () => {
    const connectivityOf = (events: MissionEvent[]) => events.filter((e) => e.type === 'participant.connectivity');

    it('tells the commander when the searcher joins the mission', async () => {
      const { commander, searcher, mission, participationId } = await setup(minutesAgo(10));
      const commanderSocket = socketFor(commander);
      await connect(commanderSocket);
      await join(commanderSocket, mission.id);
      const events = record(commanderSocket);
      const socket = socketFor(searcher);
      await connect(socket);
      await join(socket, mission.id);
      await vi.waitFor(() =>
        expect(connectivityOf(events)).toEqual([
          { type: 'participant.connectivity', missionId: mission.id, participantId: participationId, offline: false },
        ]),
      );
    });

    it('tells the commander when the connection closes and the last update is old', async () => {
      const { commander, searcher, mission, participationId } = await setup(minutesAgo(10));
      const commanderSocket = socketFor(commander);
      await connect(commanderSocket);
      await join(commanderSocket, mission.id);
      const socket = socketFor(searcher);
      await connect(socket);
      await join(socket, mission.id);
      const events = record(commanderSocket);
      socket.disconnect();
      await vi.waitFor(() =>
        expect(connectivityOf(events).at(-1)).toEqual({
          type: 'participant.connectivity',
          missionId: mission.id,
          participantId: participationId,
          offline: true,
        }),
      );
    });

    it('turns Offline once the threshold passes after the connection closed', async () => {
      const { commander, searcher, mission, participationId } = await setup(
        new Date(Date.now() - OFFLINE_AFTER_MS + 800),
      );
      const commanderSocket = socketFor(commander);
      await connect(commanderSocket);
      await join(commanderSocket, mission.id);
      const socket = socketFor(searcher);
      await connect(socket);
      await join(socket, mission.id);
      const events = record(commanderSocket);
      socket.disconnect();
      await vi.waitFor(
        () =>
          expect(connectivityOf(events).at(-1)).toEqual({
            type: 'participant.connectivity',
            missionId: mission.id,
            participantId: participationId,
            offline: true,
          }),
        { timeout: 4000 },
      );
    });

    it('turns Offline after an upload received without a connection once its time gets old', async () => {
      const { commander, searcher, mission, participationId } = await setup(null);
      const commanderSocket = socketFor(commander);
      await connect(commanderSocket);
      await join(commanderSocket, mission.id);
      const events = record(commanderSocket);
      const recordedAt = new Date(Date.now() - OFFLINE_AFTER_MS + 800).toISOString();
      const res = await injectAs(
        rt.ctx,
        searcher,
      )({
        method: 'POST',
        url: `/api/missions/${mission.id}/track-points`,
        payload: { points: [{ position: [35.13, 31.78], recordedAt, context: 'search' }] },
      });
      expect(res.statusCode).toBe(200);
      await vi.waitFor(
        () =>
          expect(connectivityOf(events).at(-1)).toEqual({
            type: 'participant.connectivity',
            missionId: mission.id,
            participantId: participationId,
            offline: true,
          }),
        { timeout: 4000 },
      );
    });

    it('does not tell searchers about anyone', async () => {
      const { commander, searcher, mission } = await setup(minutesAgo(10));
      const other = await signInSearcher(rt.ctx);
      const otherSocket = socketFor(other);
      await connect(otherSocket);
      await join(otherSocket, mission.id).catch(() => undefined);
      const events = record(otherSocket);
      const socket = socketFor(searcher);
      await connect(socket);
      await join(socket, mission.id);
      socket.disconnect();
      await settle();
      expect(connectivityOf(events)).toEqual([]);
      expect(commander).toBeDefined();
    });
  });

  it('counts the newest of the position and the battery report as the last update', async () => {
    const { list, participationId } = await setup(minutesAgo(10));
    const measuredAt = minutesAgo(1);
    await rt.ctx.db
      .update(participations)
      .set({ batteryLevel: 50, batteryMeasuredAt: measuredAt })
      .where(eq(participations.id, participationId));
    const participant = await list();
    expect(participant.offline).toBe(false);
    expect(participant.lastUpdateAt).toBe(measuredAt.toISOString());
  });
});
