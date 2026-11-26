import { latestUpdateAt, lostContactAlertDue } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { missions, participations, searchers, timelineEvents } from '../../db/schema';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';

/** The "lost contact" alert (UC-S04, decision 44). Off when the time is not configured. */
export interface LostContactConfig {
  /** The time without an update before the alert. TBD in the spec, so it comes from the environment, no default. */
  afterSeconds: number;
}

/** Records the alerts of one running mission. The mission row is locked, so two API instances alert once. */
async function alertForMission(
  deps: ServiceDeps,
  missionId: string,
  afterMs: number,
  now: Date,
): Promise<TimelineEvent[]> {
  return deps.db.transaction(async (tx) => {
    const [mission] = await tx
      .select({ status: missions.status })
      .from(missions)
      .where(eq(missions.id, missionId))
      .for('update');
    if (!mission || (mission.status !== 'active' && mission.status !== 'paused')) return [];

    const rows = await tx
      .select({
        id: participations.id,
        callsign: participations.callsign,
        name: searchers.name,
        positionAt: participations.lastPositionAt,
        batteryAt: participations.batteryMeasuredAt,
      })
      .from(participations)
      .innerJoin(searchers, eq(searchers.id, participations.searcherId))
      .where(and(eq(participations.missionId, missionId), ne(participations.status, 'ended')))
      .orderBy(asc(participations.callsign));
    const alerted = await tx
      .select({
        id: sql<string>`${timelineEvents.subject}->>'id'`,
        since: sql<string>`${timelineEvents.details}->>'lastUpdateAt'`,
      })
      .from(timelineEvents)
      .where(and(eq(timelineEvents.missionId, missionId), eq(timelineEvents.type, 'contact.no_updates')));
    const done = new Set(alerted.map(({ id, since }) => `${id}:${new Date(since).toISOString()}`));

    const events: TimelineEvent[] = [];
    for (const row of rows) {
      const lastUpdateAt = latestUpdateAt([row.positionAt, row.batteryAt]);
      if (!lastUpdateAt || !lostContactAlertDue({ lastUpdateAt, now, afterMs })) continue;
      if (done.has(`${row.id}:${lastUpdateAt.toISOString()}`)) continue;
      events.push(
        await recordEvent(tx, {
          missionId,
          actor: 'system',
          type: 'contact.no_updates',
          subject: { kind: 'participant', id: row.id, label: row.name, callsign: row.callsign },
          details: { lastUpdateAt: lastUpdateAt.toISOString() },
          occurredAt: now,
        }),
      );
    }
    return events;
  });
}

/**
 * Alerts the commander about every searcher in a running mission who has sent no update (GPS point or battery
 * report) for the configured time (UC-S04, decision 44): one `contact.no_updates` Timeline event per silence, published
 * live, never repeated while the silence lasts. A new update starts a new silence. Returns how many alerts it recorded.
 */
export async function alertLostContact(deps: ServiceDeps, now = new Date()): Promise<number> {
  if (!deps.lostContact) return 0;
  const afterMs = deps.lostContact.afterSeconds * 1000;
  const running = await deps.db
    .select({ id: missions.id })
    .from(missions)
    .where(inArray(missions.status, ['active', 'paused']));
  let recorded = 0;
  for (const { id } of running) {
    const events = await alertForMission(deps, id, afterMs, now);
    for (const event of events) deps.realtime.publish({ type: 'timeline.recorded', missionId: id, event });
    recorded += events.length;
  }
  return recorded;
}
