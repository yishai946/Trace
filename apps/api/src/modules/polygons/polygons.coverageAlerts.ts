import { newCoverageThresholds } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../../db';
import { timelineEvents } from '../../db/schema';
import { recordEvent } from '../timeline/timeline.service';

const RaisedDetails = z.object({ threshold: z.number() });

/** The thresholds already recorded for the polygon: a threshold alerts once per polygon (decision 55). */
async function raisedThresholds(tx: Tx, missionId: string, polygonId: string): Promise<number[]> {
  const rows = await tx
    .select({ details: timelineEvents.details })
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.missionId, missionId),
        eq(timelineEvents.type, 'coverage.threshold_reached'),
        sql`${timelineEvents.subject}->>'id' = ${polygonId}`,
      ),
    );
  return rows.flatMap(({ details }) => {
    const parsed = RaisedDetails.safeParse(details);
    return parsed.success ? [parsed.data.threshold] : [];
  });
}

/**
 * Records, on the mission's Timeline, each 80% / 90% threshold the polygon's Coverage has newly reached (UC-S02,
 * UC-S04). Call it inside the transaction that saved the Coverage, with the polygon row locked, so concurrent batches
 * record a threshold once. After the commit the caller publishes `timeline.recorded` for the returned events.
 */
export async function recordCoverageThresholds(
  tx: Tx,
  polygon: { missionId: string; id: string; name: string; coverage: number | null },
): Promise<TimelineEvent[]> {
  const raised = await raisedThresholds(tx, polygon.missionId, polygon.id);
  const events: TimelineEvent[] = [];
  for (const threshold of newCoverageThresholds(polygon.coverage, raised)) {
    events.push(
      await recordEvent(tx, {
        missionId: polygon.missionId,
        actor: 'system',
        type: 'coverage.threshold_reached',
        subject: { kind: 'polygon', id: polygon.id, label: polygon.name },
        details: { threshold },
      }),
    );
  }
  return events;
}
