import { MAX_TRACK_POINTS, TrackPointInput, TrackPointsResult } from '@trace/schemas';
import { ApiRequestError, apiBaseUrl, apiRequest } from '../../api';
import { enqueue, type OutboxSender } from '../../outbox';
import { useSession } from '../../state/session';
import { toTrackPoints, type Fix } from '../trackPoints';

/** The background task that receives the phone's GPS fixes (expo-task-manager). */
export const LOCATION_TASK = 'trace-location';

/**
 * Saves a batch of fixes in the outbox (UC-S01), each marked `search` or `safety` by the searcher's task now; sending
 * is a separate step, so a fix is kept on the device whatever the network does. Without a mission or a session there
 * is nowhere to send: after a force-close the store is empty, and the tracker stops with the app
 * (`killServiceOnDestroy`). shortcut: restoring the mission after a restart is #40.
 */
export async function recordFixes(fixes: Fix[]): Promise<void> {
  const { missionId, participation, token } = useSession.getState();
  if (fixes.length === 0 || !token || !missionId || !participation || participation.status === 'ended') return;
  await enqueue({ kind: 'track-point', missionId, payloads: toTrackPoints(fixes, participation) });
}

/**
 * Sends stored points to `POST /missions/:id/track-points` (UC-S01). The token is read when sending, not when
 * recording. The server dedups a point it already has (same recording time), so a batch that was sent but not
 * confirmed is safe to send again. `onParticipationEnded` hears of a mission whose activity ended, so the caller can
 * stop tracking.
 */
export function trackPointSender(onParticipationEnded: (missionId: string) => void): OutboxSender {
  return {
    batchSize: MAX_TRACK_POINTS,
    async send(missionId, items) {
      const points = items.map((item) => TrackPointInput.safeParse(item.payload));
      // A stored point the schema rejects would make the server reject the whole batch every time.
      if (points.some((point) => !point.success)) return 'drop-batch';
      const { token } = useSession.getState();
      if (!token) throw new Error('Not signed in');
      try {
        await apiRequest(`/missions/${missionId}/track-points`, {
          baseUrl: apiBaseUrl,
          token,
          method: 'POST',
          body: { points: items.map((item) => item.payload) },
          schema: TrackPointsResult,
        });
        return 'sent';
      } catch (error) {
        if (!(error instanceof ApiRequestError)) throw error;
        if (error.code === 'PARTICIPATION_ENDED') onParticipationEnded(missionId);
        if (error.status === 409 || error.status === 404 || error.status === 403) return 'drop-mission';
        if (error.status === 400) return 'drop-batch';
        throw error;
      }
    },
  };
}
