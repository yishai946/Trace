import { acceptsTrackPoints } from '@trace/domain';
import type { TrackPointsBody, TrackPointsResult } from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db';
import { participations, trackPoints } from '../../db/schema';
import { AppError, notFound } from '../../errors';

/**
 * How far past the server's clock a point may be dated and still move the last position. A phone whose clock runs
 * ahead would otherwise freeze the commander's view of the searcher until real time catches up.
 * shortcut: a fixed technical tolerance, not a spec value; revisit with the Lost Tracking time (decision 44, TBD).
 */
const CLOCK_SKEW_MS = 2 * 60 * 1000;

export interface RecordTrackResult extends TrackPointsResult {
  participantId: string;
  /** A reported GPS loss ended with this batch: the commander's view of the searcher changed. */
  gpsBack: boolean;
  /** The participation's last position after this batch, when the batch moved it forward. */
  moved: { position: LngLat; positionAt: string } | null;
}

/**
 * Saves a batch of the searcher's own GPS points (UC-S01). A point already saved (same participation and recording
 * time) is left as it was, so an upload repeated after a lost connection adds nothing. The newest point becomes the
 * participation's last position, unless a newer one is already there or it is dated in the future. A searcher whose activity ended sends nothing.
 */
export async function recordTrackPoints(
  db: Db,
  { missionId, searcherId, body }: { missionId: string; searcherId: string; body: z.output<typeof TrackPointsBody> },
): Promise<RecordTrackResult> {
  return db.transaction(async (tx) => {
    const [participation] = await tx
      .select({ id: participations.id, status: participations.status })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)))
      .for('update');
    if (!participation) throw notFound('Mission');
    if (!acceptsTrackPoints(participation.status)) {
      throw new AppError(409, 'PARTICIPATION_ENDED', 'The activity in this mission has ended');
    }

    const inserted = await tx
      .insert(trackPoints)
      .values(
        body.points.map((p) => ({
          participationId: participation.id,
          position: { type: 'Point' as const, coordinates: p.position },
          recordedAt: new Date(p.recordedAt),
          accuracy: p.accuracy,
          context: p.context,
        })),
      )
      .onConflictDoNothing({ target: [trackPoints.participationId, trackPoints.recordedAt] })
      .returning({ id: trackPoints.id });

    const latest = Date.now() + CLOCK_SKEW_MS;
    const current = body.points.filter((p) => Date.parse(p.recordedAt) <= latest);
    if (current.length === 0) {
      return {
        participantId: participation.id,
        stored: inserted.length,
        duplicates: body.points.length - inserted.length,
        moved: null,
        gpsBack: false,
      };
    }
    const newest = current.reduce((a, b) => (Date.parse(b.recordedAt) > Date.parse(a.recordedAt) ? b : a));
    const newestAt = new Date(newest.recordedAt);
    const [updated] = await tx
      .update(participations)
      .set({ lastPosition: { type: 'Point', coordinates: newest.position }, lastPositionAt: newestAt })
      .where(
        and(
          eq(participations.id, participation.id),
          or(isNull(participations.lastPositionAt), lt(participations.lastPositionAt, newestAt)),
        ),
      )
      .returning({ id: participations.id });
    // A fix newer than a reported loss means GPS is back (decision 42). An older one, sent late, says nothing about now.
    const [gpsBack] = await tx
      .update(participations)
      .set({ gpsUnavailableSince: null })
      .where(and(eq(participations.id, participation.id), lt(participations.gpsUnavailableSince, newestAt)))
      .returning({ id: participations.id });

    return {
      gpsBack: !!gpsBack,
      participantId: participation.id,
      stored: inserted.length,
      duplicates: body.points.length - inserted.length,
      moved: updated ? { position: newest.position as LngLat, positionAt: newestAt.toISOString() } : null,
    };
  });
}
