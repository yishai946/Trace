import { TRACK_CONTEXTS } from '@trace/domain';
import { z } from 'zod';
import { LngLat } from '../geo';

export const TrackContext = z.enum(TRACK_CONTEXTS).meta({ id: 'TrackContext' });

/** Most points in one upload. A phone that was offline sends what it kept in several uploads. */
export const MAX_TRACK_POINTS = 500;

/** One GPS fix as the phone recorded it (UC-S01). */
export const TrackPointInput = z
  .object({
    position: LngLat,
    /** When the phone took the fix, not when it was sent: an offline batch arrives later. */
    recordedAt: z.iso.datetime({ offset: true }),
    /** Horizontal accuracy in meters, when the phone reports it. */
    accuracy: z.number().min(0).max(100_000).nullable().default(null),
    context: TrackContext,
  })
  .meta({ id: 'TrackPointInput' });

/** POST /missions/:id/track-points: a batch of the signed-in searcher's own points, oldest or newest first. */
export const TrackPointsBody = z.object({ points: z.array(TrackPointInput).min(1).max(MAX_TRACK_POINTS) });

export const TrackPointsResult = z
  .object({
    /** Points saved now. */
    stored: z.number().int().min(0),
    /** Points already saved before (the same recording time), left as they were. */
    duplicates: z.number().int().min(0),
  })
  .meta({ id: 'TrackPointsResult' });

export type TrackPointInput = z.input<typeof TrackPointInput>;
export type TrackPointsBody = z.input<typeof TrackPointsBody>;
export type TrackPointsResult = z.infer<typeof TrackPointsResult>;
