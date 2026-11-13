import { emptyMissionMapData, type MissionMapData } from '@trace/map';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting } from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import { timeLabel } from '../timeLabel';

interface MapDataSource {
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[];
  reports: Report[];
  /** The LKP history, newest first. */
  lkps: LkpPoint[];
  selectedPolygonId: string | null;
  /** The polygon being reshaped is drawn by the editor, so the overlay hides it. */
  editingPolygonId: string | null;
}

/** What the map shows for a mission from the server's mission, polygons and participants. */
export function toMapData({
  mission,
  polygons,
  participants,
  sightings,
  reports,
  lkps,
  selectedPolygonId,
  editingPolygonId,
}: MapDataSource): MissionMapData {
  return {
    ...emptyMissionMapData,
    polygons: polygons
      .filter((p) => p.id !== editingPolygonId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        coverage: p.coverage,
        geometry: p.geometry,
        selected: p.id === selectedPolygonId,
      })),
    // Live connectivity and safety states arrive with tracking; until then every searcher shows as normal.
    units: participants.flatMap((p) =>
      p.position && p.status !== 'ended'
        ? [{ id: p.id, callsign: p.callsign, state: 'normal' as const, position: p.position }]
        : [],
    ),
    lkp: mission.lkp
      ? {
          id: 'lkp',
          position: mission.lkp.position.coordinates as LngLat,
          time: timeLabel(mission.lkp.observedAt),
        }
      : null,
    lkpHistory: lkps
      .filter((p) => !p.current)
      .map((p) => ({
        id: p.id,
        position: p.position.coordinates as LngLat,
        time: timeLabel(p.observedAt),
      })),
    // An accepted sighting is drawn as the LKP or as a past LKP, so it does not also show as a diamond.
    sightings: sightings
      .filter((s) => s.lkpDecision !== 'accepted')
      .map((s) => {
        const time = timeLabel(s.observedAt);
        return {
          id: s.id,
          position: s.position.coordinates as LngLat,
          time,
          label: `${s.number} ${time}`,
          suggested: s.lkpCandidate,
        };
      }),
    rally: mission.rallyPoint.coordinates as LngLat,
    // New and Handled reports both stay on the map (decision 81).
    reports: reports.map((r) => ({
      id: r.id,
      position: r.position.coordinates as LngLat,
      time: timeLabel(r.reportedAt),
      hazard: r.type === 'hazard',
      located: r.type === 'located',
    })),
  };
}
