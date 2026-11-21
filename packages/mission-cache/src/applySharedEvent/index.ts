import type { QueryClient } from '@tanstack/query-core';
import type { Mission, MissionEvent } from '@trace/schemas';
import { missionDataKeys } from '../keys';
import { removeReport, upsertReport, upsertSos } from '../listOrder';
import { updateOpened } from '../updateOpened';

/** Where an app keeps a mission: Command in its list of missions, Field as the one mission the searcher is in. */
export interface MissionCacheShape {
  /** Changes the cached mission; nothing when it is not cached. */
  patchMission: (queryClient: QueryClient, missionId: string, change: (mission: Mission) => Mission) => void;
  /** Puts the whole mission, as `mission.updated` sends it. */
  replaceMission: (queryClient: QueryClient, missionId: string, mission: Mission) => void;
}

/**
 * Applies the events whose cache change is the same in Command and Field: the mission's LKP, rally point and details
 * (UC-C03, UC-C04, UC-C05), the reports (UC-C11, UC-F11) and the SOS (UC-F13). Other events are left to the app.
 */
export function applySharedEvent(queryClient: QueryClient, shape: MissionCacheShape, event: MissionEvent): void {
  const { missionId } = event;
  switch (event.type) {
    case 'lkp.changed':
      shape.patchMission(queryClient, missionId, (mission) => ({ ...mission, lkp: event.lkp }));
      return;
    case 'rally.changed':
      shape.patchMission(queryClient, missionId, (mission) => ({
        ...mission,
        rallyPoint: event.rallyPoint,
        updatedAt: event.updatedAt,
      }));
      return;
    case 'mission.updated':
      shape.replaceMission(queryClient, missionId, event.mission);
      return;
    case 'report.saved':
      updateOpened(queryClient, missionDataKeys.reports(missionId), upsertReport(event.report));
      return;
    case 'report.deleted':
      updateOpened(queryClient, missionDataKeys.reports(missionId), removeReport(event.reportId));
      return;
    case 'sos.saved':
      updateOpened(queryClient, missionDataKeys.sos(missionId), upsertSos(event.sos));
      return;
    default:
      return;
  }
}
