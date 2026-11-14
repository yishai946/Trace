import { boundsOf, type LngLat } from '@trace/geo';
import type { LkpPoint, Mission, MissionPolygon, Participant, Report, Sighting } from '@trace/schemas';
import { useMemo, useState } from 'react';
import { toMapData } from '../../mission/toMapData';

interface WorkspaceMapInput {
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[] | undefined;
  lkps: LkpPoint[] | undefined;
  reports: Report[];
  selectedPolygonId: string | null;
  editingPolygonId: string | null;
  /** The spot chosen for a new sighting: it shows on the map before it is saved. */
  draftPosition: LngLat | null;
}

/** What the mission's map draws, and where it opens. */
export function useWorkspaceMapData({
  mission,
  polygons,
  participants,
  sightings,
  lkps,
  reports,
  selectedPolygonId,
  editingPolygonId,
  draftPosition,
}: WorkspaceMapInput) {
  // The map opens on everything the mission has placed: polygons, rally point and LKP. Read once, at mount.
  const [initialView] = useState(() => {
    const points = [mission.rallyPoint, ...(mission.lkp ? [mission.lkp.position] : [])];
    const bounds = boundsOf({
      type: 'GeometryCollection',
      geometries: [...points, ...polygons.map((p) => p.geometry)],
    });
    return { center: mission.rallyPoint.coordinates as LngLat, zoom: 14, bounds };
  });

  const saved = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        reports,
        selectedPolygonId,
        editingPolygonId,
      }),
    [mission, polygons, participants, sightings, lkps, reports, selectedPolygonId, editingPolygonId],
  );
  const data = useMemo(
    () =>
      draftPosition
        ? { ...saved, sightings: [...saved.sightings, { id: 'draft', position: draftPosition, label: 'תצפית חדשה' }] }
        : saved,
    [saved, draftPosition],
  );

  return { initialView, data };
}
