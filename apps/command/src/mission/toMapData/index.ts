import type { LngLat } from '@trace/geo';
import { emptyMissionMapData, type MapUnit, type MissionMapData } from '@trace/map';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting, Sos } from '@trace/schemas';
import { timeLabel } from '../timeLabel';

interface MapDataSource {
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[];
  reports: Report[];
  /** The mission's SOS; the active ones with a location are marked. The Reports screens leave it out. */
  sos?: Sos[];
  /** The LKP history, newest first. */
  lkps: LkpPoint[];
  selectedPolygonId: string | null;
  /** The polygon being reshaped is drawn by the editor, so the overlay hides it. */
  editingPolygonId: string | null;
  /** The route of the searcher whose panel is open (UC-C10); drawn on the map. */
  route?: { participantId: string; positions: LngLat[] } | null;
}

const unitState = (p: Participant): MapUnit['state'] =>
  p.offline ? 'offline' : p.gpsUnavailableSince ? 'warning' : 'normal';

/** What the map shows for a mission from the server's mission, polygons and participants. */
export function toMapData({
  mission,
  polygons,
  participants,
  sightings,
  reports,
  sos = [],
  lkps,
  selectedPolygonId,
  editingPolygonId,
  route = null,
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
    // Offline (no live connection and no recent update) wins over a GPS warning. Battery and out-of-polygon warnings
    // wait for their alert rules (UC-S04).
    units: participants.flatMap((p) =>
      p.position && p.status !== 'ended'
        ? [{ id: p.id, callsign: p.callsign, state: unitState(p), position: p.position }]
        : [],
    ),
    tracks: route ? [{ unitId: route.participantId, positions: route.positions }] : [],
    lkp: mission.lkp
      ? {
          id: 'lkp',
          position: mission.lkp.position.coordinates,
          time: timeLabel(mission.lkp.observedAt),
        }
      : null,
    lkpHistory: lkps
      .filter((p) => !p.current)
      .map((p) => ({
        id: p.id,
        position: p.position.coordinates,
        time: timeLabel(p.observedAt),
      })),
    // An accepted sighting is drawn as the LKP or as a past LKP, so it does not also show as a diamond.
    sightings: sightings
      .filter((s) => s.lkpDecision !== 'accepted')
      .map((s) => {
        const time = timeLabel(s.observedAt);
        return {
          id: s.id,
          position: s.position.coordinates,
          time,
          label: `${s.number} ${time}`,
          suggested: s.lkpCandidate,
        };
      }),
    rally: mission.rallyPoint.coordinates,
    // New and Handled reports both stay on the map (decision 81).
    reports: reports.map((r) => ({
      id: r.id,
      position: r.position.coordinates,
      time: timeLabel(r.reportedAt),
      hazard: r.type === 'hazard',
      located: r.type === 'located',
    })),
    sos: sos.flatMap((s) =>
      s.status === 'active' && s.location
        ? [{ id: s.id, position: s.location.position.coordinates, callsign: s.sender.callsign }]
        : [],
    ),
  };
}
