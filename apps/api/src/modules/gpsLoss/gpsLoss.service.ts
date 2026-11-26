import { gpsLossEscalationDue, isMissionEnded } from '@trace/domain';
import { and, eq, sql } from 'drizzle-orm';
import { missions, participations, searchers, timelineEvents } from '../../db/schema';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';

/** The delayed check queued when a searcher's GPS is lost: which loss it is about (`since` is its ISO time). */
export interface GpsLossJob {
  participationId: string;
  since: string;
}

/** Queues a check to run after the given delay (decision 42: the escalation waits a configured time). */
export interface GpsLossScheduler {
  schedule(job: GpsLossJob, afterSeconds: number): Promise<void>;
}

export interface GpsLossConfig {
  /** The time without GPS before the escalation. TBD in the spec, so it comes from the environment, with no default. */
  afterSeconds: number;
  scheduler: GpsLossScheduler;
}

/** Queues the escalation check for a GPS loss that just started. Best effort: a failure is logged, never thrown. */
export async function scheduleGpsLossEscalation(deps: ServiceDeps, job: GpsLossJob): Promise<void> {
  if (!deps.gpsLoss) return;
  try {
    await deps.gpsLoss.scheduler.schedule(job, deps.gpsLoss.afterSeconds);
  } catch (err) {
    deps.log.error({ err, participationId: job.participationId }, 'scheduling the GPS loss escalation failed');
  }
}

/**
 * What a check did: `escalated`, `early` (the time has not passed yet, so the job must run again), `stale` (the GPS
 * came back, was lost again later, or the searcher's activity or the mission ended) or `done` (already escalated).
 */
export type GpsLossOutcome = 'escalated' | 'early' | 'stale' | 'done';

/**
 * Escalates a GPS loss to the commander once it has lasted the configured time (UC-S04, decision 42): one
 * `gps.lost_escalated` event on the Timeline, published live. Safe to run again: a loss escalates once.
 */
export async function escalateGpsLoss(deps: ServiceDeps, job: GpsLossJob, now = new Date()): Promise<GpsLossOutcome> {
  if (!deps.gpsLoss) return 'stale';
  const afterMs = deps.gpsLoss.afterSeconds * 1000;
  const event = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        missionId: participations.missionId,
        missionStatus: missions.status,
        status: participations.status,
        callsign: participations.callsign,
        name: searchers.name,
        since: participations.gpsUnavailableSince,
      })
      .from(participations)
      .innerJoin(missions, eq(missions.id, participations.missionId))
      .innerJoin(searchers, eq(searchers.id, participations.searcherId))
      .where(eq(participations.id, job.participationId))
      .for('update', { of: participations });
    if (!row || row.status === 'ended' || isMissionEnded(row.missionStatus)) return 'stale';
    if (row.since?.toISOString() !== new Date(job.since).toISOString()) return 'stale';
    if (!gpsLossEscalationDue({ since: row.since, now, afterMs })) return 'early';
    const [already] = await tx
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.missionId, row.missionId),
          eq(timelineEvents.type, 'gps.lost_escalated'),
          sql`${timelineEvents.subject}->>'id' = ${job.participationId}`,
          sql`${timelineEvents.details}->>'since' = ${row.since.toISOString()}`,
        ),
      );
    if (already) return 'done';
    return recordEvent(tx, {
      missionId: row.missionId,
      actor: 'system',
      type: 'gps.lost_escalated',
      subject: { kind: 'participant', id: job.participationId, label: row.name, callsign: row.callsign },
      details: { since: row.since.toISOString() },
    });
  });
  if (typeof event === 'string') return event;
  deps.realtime.publish({ type: 'timeline.recorded', missionId: event.missionId, event });
  return 'escalated';
}
