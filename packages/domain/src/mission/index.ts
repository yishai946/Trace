/** Mission lifecycle (State and Rules Reference §1). A new mission starts `active`; there is no draft. */
export const MISSION_STATUSES = ['active', 'paused', 'ended_located', 'ended_stopped'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export function isMissionEnded(status: MissionStatus): boolean {
  return status === 'ended_located' || status === 'ended_stopped';
}

/** Polygons are created, edited and deleted only while the mission is active (UC-C06). */
export function canChangePolygons(status: MissionStatus): boolean {
  return status === 'active';
}

/** The rally point can be moved while the mission runs, active or paused, and not once it ended (UC-C05). */
export function canChangeRallyPoint(status: MissionStatus): boolean {
  return !isMissionEnded(status);
}

/** Mission and missing-person details can be edited while the mission runs, active or paused (UC-C03, decision 94). */
export function canEditMissionDetails(status: MissionStatus): boolean {
  return !isMissionEnded(status);
}
