import type { MissionPolygon, Participant } from '@trace/schemas';

export interface SearcherGroup {
  /** The polygon the searchers are assigned to; null for those still waiting for an assignment. */
  polygon: MissionPolygon | null;
  searchers: Participant[];
}

/**
 * The searchers of the Cd04 panel (UC-C10): one group per polygon that has searchers, in the order of `polygons`, then those
 * waiting for an assignment. Searchers who ended are left out; each group is ordered by callsign.
 */
export function groupSearchers(participants: Participant[], polygons: MissionPolygon[]): SearcherGroup[] {
  const inMission = participants.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);
  const known = new Set(polygons.map((p) => p.id));
  const assigned = (id: string) => (p: Participant) => p.status === 'assigned' && p.polygonId === id;
  const groups: SearcherGroup[] = polygons.map((polygon) => ({
    polygon,
    searchers: inMission.filter(assigned(polygon.id)),
  }));
  const waiting = inMission.filter((p) => !(p.status === 'assigned' && p.polygonId && known.has(p.polygonId)));
  return [...groups, { polygon: null, searchers: waiting }].filter((g) => g.searchers.length > 0);
}
