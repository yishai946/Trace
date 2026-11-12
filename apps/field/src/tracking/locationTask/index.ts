import { TrackPointsResult } from '@trace/schemas';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';
import { toTrackPoints, type Fix } from '../trackPoints';

/** The background task that receives the phone's GPS fixes (expo-task-manager). */
export const LOCATION_TASK = 'trace-location';

/**
 * Sends one batch of fixes from the background task to the API (UC-S01). Without a mission or a session there is
 * nowhere to send: after a force-close the store is empty, and the tracker stops with the app (`killServiceOnDestroy`).
 * shortcut: a batch that fails to upload is lost; keeping it on the device is #76 (outbox #97), restoring the mission
 * after a restart is #40.
 */
export async function uploadFixes(fixes: Fix[]): Promise<void> {
  const { missionId, participation, token } = useSession.getState();
  if (fixes.length === 0 || !token || !missionId || !participation || participation.status === 'ended') return;
  await apiRequest(`/missions/${missionId}/track-points`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    body: { points: toTrackPoints(fixes, participation) },
    schema: TrackPointsResult,
  });
}
