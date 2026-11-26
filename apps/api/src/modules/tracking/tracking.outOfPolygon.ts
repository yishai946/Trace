import { isActiveInPolygon, isMissionEnded, nextPolygonPresence } from '@trace/domain';
import { distanceOutsideMeters, type LngLat } from '@trace/geo';
import { PolygonGeometry, type TimelineEvent } from '@trace/schemas';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, polygons, searchers, timelineEvents } from '../../db/schema';
import { sendMessage } from '../messages/messages.service';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';

/** What a position changed about a searcher's presence in the polygon, for the caller to announce after the commit. */
export interface PresenceAlert {
  event: TimelineEvent;
  polygonName: string;
}

const RecordedDetails = z.object({ polygonId: z.uuid() });

/** Whether the searcher's last recorded presence event for this polygon is "left": the state the Timeline holds. */
async function wasOutside(tx: Tx, input: { missionId: string; participantId: string; polygonId: string }) {
  const [last] = await tx
    .select({ type: timelineEvents.type, details: timelineEvents.details })
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.missionId, input.missionId),
        inArray(timelineEvents.type, ['searcher.left_polygon', 'searcher.returned_to_polygon']),
        sql`${timelineEvents.subject}->>'id' = ${input.participantId}`,
        sql`${timelineEvents.details}->>'polygonId' = ${input.polygonId}`,
      ),
    )
    .orderBy(desc(timelineEvents.seq))
    .limit(1);
  return !!last && last.type === 'searcher.left_polygon' && RecordedDetails.safeParse(last.details).success;
}

/**
 * Records, on the Timeline, that a searcher who is Searching left the polygon they are assigned to, or came back
 * (UC-S04, decision 14). Judged by `position`, the searcher's newest position. Nothing repeats while the state
 * persists: the previous event decides. A searcher who is not Searching (travelling to the polygon, paused) or has no
 * polygon raises nothing. Call it inside the batch's transaction; the caller announces the result after the commit.
 */
export async function recordPolygonPresence(
  tx: Tx,
  input: { participationId: string; position: LngLat; at: Date; toleranceMeters: number },
): Promise<PresenceAlert | null> {
  const [row] = await tx
    .select({
      missionId: participations.missionId,
      missionStatus: missions.status,
      status: participations.status,
      polygonId: participations.polygonId,
      taskStatus: participations.taskStatus,
      callsign: participations.callsign,
      name: searchers.name,
    })
    .from(participations)
    .innerJoin(missions, eq(missions.id, participations.missionId))
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.id, input.participationId));
  if (!row?.polygonId || row.taskStatus !== 'searching' || isMissionEnded(row.missionStatus)) return null;
  if (!isActiveInPolygon(row, row.polygonId)) return null;
  const [polygon] = await tx
    .select({ name: polygons.name, geometry: asGeoJson(polygons.geometry) })
    .from(polygons)
    .where(and(eq(polygons.id, row.polygonId), isNull(polygons.deletedAt)));
  if (!polygon) return null;

  const outsideMeters = distanceOutsideMeters(input.position, PolygonGeometry.parse(JSON.parse(polygon.geometry)));
  const change = nextPolygonPresence({
    outsideMeters,
    toleranceMeters: input.toleranceMeters,
    wasOutside: await wasOutside(tx, {
      missionId: row.missionId,
      participantId: input.participationId,
      polygonId: row.polygonId,
    }),
  });
  if (!change) return null;
  const base = {
    missionId: row.missionId,
    actor: 'system',
    subject: { kind: 'participant', id: input.participationId, label: row.name, callsign: row.callsign },
    occurredAt: input.at,
  } as const;
  const details = { polygonId: row.polygonId, polygonName: polygon.name };
  const event =
    change === 'left'
      ? await recordEvent(tx, {
          ...base,
          type: 'searcher.left_polygon',
          details: { ...details, meters: Math.round(outsideMeters) },
        })
      : await recordEvent(tx, { ...base, type: 'searcher.returned_to_polygon', details });
  return { event, polygonName: polygon.name };
}

/**
 * Announces a recorded presence change after the commit: the commander sees the Timeline event at once, and a
 * searcher who left gets an `important` message (inbox, live and push), the Field alert. Best effort: the event is
 * already saved, so a failed message is logged and never fails the upload.
 */
export async function announcePresence(deps: ServiceDeps, { event, polygonName }: PresenceAlert): Promise<void> {
  deps.realtime.publish({ type: 'timeline.recorded', missionId: event.missionId, event });
  if (event.type !== 'searcher.left_polygon') return;
  try {
    const [mission] = await deps.db
      .select({ commanderId: missions.commanderId })
      .from(missions)
      .where(eq(missions.id, event.missionId));
    if (!mission) return;
    // The message channel has only commanders as senders (UC-C12): it goes out under the mission's commander.
    await sendMessage(deps, {
      missionId: event.missionId,
      sentBy: mission.commanderId,
      message: {
        urgency: 'important',
        body: `יצאתם מהגבול של ${polygonName}. חזרו לתוך האזור או פנו למנהל.`,
        target: { kind: 'searcher', participantId: event.subject.id },
      },
    });
  } catch (err) {
    deps.log.warn({ err, missionId: event.missionId, participantId: event.subject.id }, 'out-of-polygon alert failed');
  }
}
