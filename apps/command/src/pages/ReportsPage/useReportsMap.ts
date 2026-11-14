import type { Mission, MissionPolygon, Participant, Report, LkpPoint, Sighting } from '@trace/schemas';
import { useMemo, useState } from 'react';
import { initialReportsView } from '../../mission/reportView';
import { toMapData } from '../../mission/toMapData';

interface Input {
  mission: Mission;
  polygons: MissionPolygon[];
  participants: Participant[];
  sightings: Sighting[] | undefined;
  lkps: LkpPoint[] | undefined;
  /** Newest first. Undefined while they load. */
  reports: Report[] | undefined;
}

/** What the Reports map draws, and where it opens. */
export function useReportsMap({ mission, polygons, participants, sightings, lkps, reports }: Input) {
  const all = reports ?? [];
  // The map opens on everything the mission placed: polygons, rally point, LKP and reports. Read once, at mount.
  const [initialView] = useState(() => initialReportsView({ mission, polygons, reports: all }));
  const data = useMemo(
    () =>
      toMapData({
        mission,
        polygons,
        participants,
        sightings: sightings ?? [],
        lkps: lkps ?? [],
        reports: reports ?? [],
        selectedPolygonId: null,
        editingPolygonId: null,
      }),
    [mission, polygons, participants, sightings, lkps, reports],
  );

  return { initialView, data };
}
