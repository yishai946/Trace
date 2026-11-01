/** A searcher's participation in a mission (State and Rules Reference §2). */
export const PARTICIPATION_STATUSES = ['available', 'assigned', 'ended'] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

/** The search task inside an assignment. `finished` ends the task, not the assignment or the participation. */
export const TASK_STATUSES = ['ready', 'searching', 'paused', 'finished'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface PolygonMember {
  status: ParticipationStatus;
  polygonId: string | null;
}

/**
 * A searcher counts as active in a polygon while assigned to it, whatever the task status:
 * after "finished search" the searcher stays assigned until the commander decides (decision 100).
 * An active searcher blocks deleting the polygon (UC-C06, decision 36).
 */
export function isActiveInPolygon(member: PolygonMember, polygonId: string): boolean {
  return member.status === 'assigned' && member.polygonId === polygonId;
}
