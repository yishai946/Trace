import type { ParticipationStatus, TaskStatus } from '../participation';

/**
 * What a GPS point was recorded for (UC-S01 step 2): `search` while the searcher is Searching, so it may count toward
 * Coverage; `safety` otherwise (paused, waiting, travelling), for the searcher's safety only.
 */
export const TRACK_CONTEXTS = ['search', 'safety'] as const;
export type TrackContext = (typeof TRACK_CONTEXTS)[number];

/** The context Field gives a point it records now, from the participation's state (the LocationTracker, #75). */
export function trackContextOf(taskStatus: TaskStatus | null): TrackContext {
  return taskStatus === 'searching' ? 'search' : 'safety';
}

/** Points are taken from a searcher until their activity ended (Finish Activity, UC-F15), whatever the mission's state. */
export function acceptsTrackPoints(status: ParticipationStatus): boolean {
  return status !== 'ended';
}
