import { OFFLINE_AFTER_MS } from '@trace/domain';
import { ParticipantList } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { participations } from '../db/schema';
import { addParticipant, injectAs, signInCommander, signInSearcher } from '../testing';
import { setupRealtime } from './fixtures';

describe('searcher connectivity (UC-C10)', () => {
  const rt = setupRealtime();
  const { socketFor, connect, join, createMissionAs } = rt;

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
