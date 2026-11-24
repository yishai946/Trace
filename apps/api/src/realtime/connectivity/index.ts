import { isSearcherOffline, latestUpdateAt, OFFLINE_AFTER_MS } from '@trace/domain';
import type { MissionEvent } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { participations } from '../../db/schema';

export interface ConnectivityWatcherDeps {
  db: Db;
  /** The searchers whose phone holds the mission's live connection now. */
  connectedSearcherIds(missionId: string): Promise<ReadonlySet<string>>;
  publish(event: MissionEvent): void;
  onError(error: unknown): void;
}

/**
 * Tells the commander when a searcher turns Online or Offline without a new position (UC-C10, decision 13): when their
 * phone joins or leaves the mission's connection, and once the threshold passes after their last update while they hold
 * no connection. `Participant.offline` itself is computed when the list is read; this only announces its changes.
 */
export function createConnectivityWatcher({ db, connectedSearcherIds, publish, onError }: ConnectivityWatcherDeps) {
  const timers = new Map<string, NodeJS.Timeout>();

  async function announce(missionId: string, searcherId: string): Promise<void> {
    const key = `${missionId}:${searcherId}`;
    clearTimeout(timers.get(key));
    timers.delete(key);
    const [row] = await db
      .select({
        id: participations.id,
        positionAt: participations.lastPositionAt,
        batteryMeasuredAt: participations.batteryMeasuredAt,
      })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)));
    if (!row) return;
    const connected = (await connectedSearcherIds(missionId)).has(searcherId);
    const lastUpdateAt = latestUpdateAt([row.positionAt, row.batteryMeasuredAt]);
    const now = new Date();
    const offline = isSearcherOffline({ connected, lastUpdateAt, now });
    publish({ type: 'participant.connectivity', missionId, participantId: row.id, offline });
    if (connected || offline || !lastUpdateAt) return;
    // Online by its last update only: look again when that update gets old enough.
    const wait = lastUpdateAt.getTime() + OFFLINE_AFTER_MS - now.getTime() + 1;
    const timer = setTimeout(() => {
      timers.delete(key);
      announce(missionId, searcherId).catch(onError);
    }, wait);
    timer.unref();
    timers.set(key, timer);
  }

  return {
    /** A searcher's phone joined or left a mission: announce the state they are in now. */
    changed(missionId: string, searcherId: string) {
      announce(missionId, searcherId).catch(onError);
    },
    close() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
