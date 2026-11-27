import { trackContextOf } from '@trace/domain';
import type { OwnParticipation, TrackPointInput } from '@trace/schemas';
import { taskStatusAt } from '../taskIntervals';

/** A GPS fix as the phone reports it (expo-location `LocationObject`): only the fields a track point needs. */
export interface Fix {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  /** Milliseconds since the epoch. */
  timestamp: number;
}

/**
 * The fixes of one batch as track points (UC-S01), each marked by the searcher's task when the fix was recorded:
 * `search` while Searching, `safety` otherwise (paused, before Start Search after a move, travelling). A batch
 * delivered late, after Resume, still labels a fix taken while paused as `safety` (decision 71). A time with no known
 * status falls back to the task now.
 */
export function toTrackPoints(fixes: Fix[], participation: Pick<OwnParticipation, 'taskStatus'>): TrackPointInput[] {
  return fixes.map((fix) => ({
    position: [fix.coords.longitude, fix.coords.latitude],
    recordedAt: new Date(fix.timestamp).toISOString(),
    accuracy: fix.coords.accuracy,
    context: trackContextOf(taskStatusAt(fix.timestamp) ?? participation.taskStatus),
  }));
}
