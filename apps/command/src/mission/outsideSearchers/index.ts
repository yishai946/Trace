import { isActiveInPolygon } from '@trace/domain';
import type { Participant, TimelineEvent } from '@trace/schemas';

/** A searcher who is outside the polygon they are Searching in now (UC-S04, wireframe Cd09). */
export interface OutsideSearcher {
  participantId: string;
  callsign: number;
  name: string;
  polygonName: string;
  /** How far outside when they left. */
  meters: number;
  /** When they left (ISO). */
  since: string;
}

/**
 * Who is outside their polygon now, earliest exit first, from the Timeline (oldest event first) and the searchers.
 * A searcher is outside while their last presence event is "left"; one who is no longer Searching in that polygon
 * (paused, reassigned, activity ended) is not listed, so a stale alert does not stay.
 */
export function outsideSearchers(events: TimelineEvent[], participants: Participant[]): OutsideSearcher[] {
  const outside = new Map<string, OutsideSearcher & { polygonId: string }>();
  for (const event of events) {
    if (event.type === 'searcher.returned_to_polygon') outside.delete(event.subject.id);
    if (event.type !== 'searcher.left_polygon') continue;
    outside.set(event.subject.id, {
      participantId: event.subject.id,
      callsign: event.subject.callsign ?? 0,
      name: event.subject.label ?? '',
      polygonId: event.details.polygonId,
      polygonName: event.details.polygonName,
      meters: event.details.meters,
      since: event.occurredAt,
    });
  }
  return [...outside.values()]
    .filter(({ participantId, polygonId }) => {
      const searcher = participants.find((p) => p.id === participantId);
      return !!searcher && searcher.taskStatus === 'searching' && isActiveInPolygon(searcher, polygonId);
    })
    .map(({ polygonId: _polygonId, ...searcher }) => searcher)
    .sort((a, b) => Date.parse(a.since) - Date.parse(b.since));
}
