import { canChangeLkp, canChangePolygons, type MissionStatus } from '@trace/domain';
import type { usePolygonEdit } from './usePolygonEdit';
import type { useSightingPanel } from './useSightingPanel';

/** What the commander may change on the map: nothing once the mission ended, and nothing offline (UC-C01). */
export function useWorkspaceAccess(
  status: MissionStatus,
  online: boolean,
  polygon: ReturnType<typeof usePolygonEdit>,
  sighting: ReturnType<typeof useSightingPanel>,
) {
  const canEditPolygons = canChangePolygons(status) && online;
  const canChangeSightings = canChangeLkp(status) && online;
  const canToggleSighting = (canChangeSightings || !!sighting.adding) && !polygon.editing;
  return { canEditPolygons, canChangeSightings, canToggleSighting };
}
