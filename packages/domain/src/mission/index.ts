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

/** LKP and sightings can change while the mission is active or paused; an ended mission is read-only (spec §6). */
export function canChangeLkp(status: MissionStatus): boolean {
  return !isMissionEnded(status);
}
