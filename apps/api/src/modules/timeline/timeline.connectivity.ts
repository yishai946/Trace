import { isSearcherOffline, latestUpdateAt } from '@trace/domain';
import { TimelineSubject, type TimelineEvent } from '@trace/schemas';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db, Tx } from '../../db';
import { missions, participations, searchers, timelineEvents } from '../../db/schema';
import { logAndReport } from '../../monitoring';
import type { Realtime } from '../../realtime';
import { recordEvent } from './timeline.service';

export interface ConnectivityDeps {
  db: Db;
  realtime: Pick<Realtime, 'publish' | 'connectedSearcherIds'>;
}

/** Whether the searcher's last recorded connectivity event is "lost", by participation id. Absent: none recorded. */
async function lastLostByParticipant(tx: Tx, missionId: string): Promise<Map<string, boolean>> {
  const rows = await tx
    .select({ type: timelineEvents.type, subject: timelineEvents.subject })
    .from(timelineEvents)
    .where(
      and(eq(timelineEvents.missionId, missionId), inArray(timelineEvents.type, ['contact.lost', 'contact.restored'])),
    )
    .orderBy(asc(timelineEvents.seq));
  const lost = new Map<string, boolean>();
  for (const { type, subject } of rows) {
    const parsed = TimelineSubject.safeParse(subject);
    if (parsed.success) lost.set(parsed.data.id, type === 'contact.lost');
  }
  return lost;
}

/**
 * Records the Offline and return transitions of one mission's searchers. The mission row is locked so two API
 * instances checking at once record each transition once.
 */
async function recordForMission(
  { db, realtime }: ConnectivityDeps,
  missionId: string,
  now: Date,
): Promise<TimelineEvent[]> {
  const connected = await realtime.connectedSearcherIds(missionId);
  return db.transaction(async (tx) => {
    const [mission] = await tx
      .select({ status: missions.status })
      .from(missions)
      .where(eq(missions.id, missionId))
      .for('update');
    if (!mission || (mission.status !== 'active' && mission.status !== 'paused')) return [];

    const rows = await tx
      .select({
        id: participations.id,
        searcherId: participations.searcherId,
        callsign: participations.callsign,
        name: searchers.name,
        positionAt: participations.lastPositionAt,
        batteryAt: participations.batteryMeasuredAt,
      })
      .from(participations)
      .innerJoin(searchers, eq(searchers.id, participations.searcherId))
      .where(and(eq(participations.missionId, missionId), ne(participations.status, 'ended')))
      .orderBy(asc(participations.callsign));
    const wasLost = await lastLostByParticipant(tx, missionId);

    const events: TimelineEvent[] = [];
    for (const row of rows) {
      const lastUpdateAt = latestUpdateAt([row.positionAt, row.batteryAt]);
      const offline = isSearcherOffline({ connected: connected.has(row.searcherId), lastUpdateAt, now });
      const lost = wasLost.get(row.id) ?? false;
      // A searcher who never reported was never online: there is no loss to record.
      const type = offline && !lost && lastUpdateAt ? 'contact.lost' : !offline && lost ? 'contact.restored' : null;
      if (!type) continue;
      events.push(
        await recordEvent(tx, {
          missionId,
          type,
          details: {},
          actor: 'system',
          subject: { kind: 'participant', id: row.id, label: row.name, callsign: row.callsign },
          occurredAt: now,
        }),
      );
    }
    return events;
  });
}

/**
 * Records, for every running mission, the searchers who went Offline or came back since the last check (UC-C10): one
 * Timeline event per transition, never a repeat. Returns how many events it recorded; the commander gets each live.
 */
export async function recordConnectivityChanges(deps: ConnectivityDeps, now = new Date()): Promise<number> {
  const running = await deps.db
    .select({ id: missions.id })
    .from(missions)
    .where(inArray(missions.status, ['active', 'paused']));
  let recorded = 0;
  for (const { id } of running) {
    const events = await recordForMission(deps, id, now);
    for (const event of events) deps.realtime.publish({ type: 'timeline.recorded', missionId: id, event });
    recorded += events.length;
  }
  return recorded;
}

/** Checks connectivity every `everyMs` until the returned function is called. A failed check is logged and retried. */
export function startConnectivityMonitor(deps: ConnectivityDeps & { log: FastifyBaseLogger }, everyMs: number) {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    recordConnectivityChanges(deps)
      .catch((error: unknown) =>
        logAndReport(deps.log, error, { source: 'timeline.connectivity', message: 'Connectivity check failed' }),
      )
      .finally(() => {
        running = false;
      });
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
