import { emptyMissionMapData, type MissionMapData } from '@trace/map';
import type { Mission, MissionPolygon, Participant } from '@trace/schemas';
import type { LngLat } from '@trace/geo';

interface MapDataSource {
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  selectedPolygonId: string | null;
  /** The polygon being reshaped is drawn by the editor, so the overlay hides it. */
  editingPolygonId: string | null;
}

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    // Missions run in Israel; times read the same on every commander's screen.
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(iso));

/** What the map shows for a mission from the server's mission, polygons and participants. */
export function toMapData({
  mission,
  polygons,
  participants,
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
    rally: mission.rallyPoint.coordinates as LngLat,
  };
}
