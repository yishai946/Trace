import { trackContextOf } from '@trace/domain';
import type { OwnParticipation, TrackPointInput } from '@trace/schemas';

/** A GPS fix as the phone reports it (expo-location `LocationObject`): only the fields a track point needs. */
export interface Fix {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  /** Milliseconds since the epoch. */
  timestamp: number;
}

/**
 * The fixes of one batch as track points (UC-S01), each marked by the searcher's task now: `search` while Searching,
 * `safety` otherwise (paused, before Start Search after a move, travelling).
 */
export function toTrackPoints(fixes: Fix[], participation: Pick<OwnParticipation, 'taskStatus'>): TrackPointInput[] {
  const context = trackContextOf(participation.taskStatus);
  return fixes.map((fix) => ({
    position: [fix.coords.longitude, fix.coords.latitude],
    recordedAt: new Date(fix.timestamp).toISOString(),
    accuracy: fix.coords.accuracy,
    context,
  }));
}
