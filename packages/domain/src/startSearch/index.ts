import { isMissionEnded, type MissionStatus } from '../mission';
import type { ParticipationStatus, TaskStatus } from '../participation';
import { missingOfflineParts, type OfflinePackagePart, type SavedOfflineParts } from '../offlinePackage';

/**
 * What the phone must allow before Start Search (UC-F06 preconditions): location, location in the background and
 * notifications. The camera is optional: it is only asked for when a report takes a photo.
 */
export const REQUIRED_PERMISSIONS = ['location', 'backgroundLocation', 'push'] as const;
export type RequiredPermission = (typeof REQUIRED_PERMISSIONS)[number];

/** What the searcher granted so far. A permission that is absent or `false` is not granted. */
export type GrantedPermissions = Partial<Record<RequiredPermission, boolean>>;

export interface StartSearchBlockers {
  ready: boolean;
  missingParts: OfflinePackagePart[];
  missingPermissions: RequiredPermission[];
}

/** The required permissions not granted yet, in the order of `REQUIRED_PERMISSIONS`. */
export function missingPermissions(granted: GrantedPermissions): RequiredPermission[] {
  return REQUIRED_PERMISSIONS.filter((permission) => granted[permission] !== true);
}

/**
 * Everything that keeps Start Search closed (UC-F06, decisions 73 and 85): the offline package not saved completely,
 * and a required permission not granted. Without them the searcher may still join and watch the mission.
 */
export function startSearchBlockers(saved: SavedOfflineParts, granted: GrantedPermissions): StartSearchBlockers {
  const missingParts = missingOfflineParts(saved);
  const missing = missingPermissions(granted);
  return { ready: missingParts.length === 0 && missing.length === 0, missingParts, missingPermissions: missing };
}

export type StartSearchRefusal =
  'mission_ended' | 'mission_not_active' | 'participation_ended' | 'not_assigned' | 'task_not_ready';

/**
 * Why the server refuses Start Search (UC-F06), or null when it accepts. The mission must be active (blocked while
 * Paused or Ended), the searcher assigned and their task at Ready: a task already searching, paused or finished is
 * not started again here (resuming is UC-F07).
 */
export function startSearchRefusal(state: {
  missionStatus: MissionStatus;
  participationStatus: ParticipationStatus;
  taskStatus: TaskStatus | null;
}): StartSearchRefusal | null {
  if (isMissionEnded(state.missionStatus)) return 'mission_ended';
  if (state.missionStatus !== 'active') return 'mission_not_active';
  if (state.participationStatus === 'ended') return 'participation_ended';
  if (state.participationStatus !== 'assigned') return 'not_assigned';
  return state.taskStatus === 'ready' ? null : 'task_not_ready';
}
