import { TrackPointsResult } from '@trace/schemas';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';
import { loadToken } from '../../state/session/tokenStore';
import { toTrackPoints, type Fix } from '../trackPoints';

/** The background task that receives the phone's GPS fixes (expo-task-manager). */
export const LOCATION_TASK = 'trace-location';

/**
 * Sends one batch of fixes from the background task to the API (UC-S01). The task can run while the screens are not
 * mounted, so the token falls back to the one saved on the device. Without a mission there is nowhere to send.
 * shortcut: a batch that fails to upload is lost; keeping it on the device is #76 (outbox #97).
 */
export async function uploadFixes(fixes: Fix[]): Promise<void> {
  const { missionId, participation, token } = useSession.getState();
  if (fixes.length === 0 || !missionId || !participation || participation.status === 'ended') return;
  const session = token ?? (await loadToken());
  if (!session) return;
  await apiRequest(`/missions/${missionId}/track-points`, {
    baseUrl: apiBaseUrl,
    token: session,
    method: 'POST',
    body: { points: toTrackPoints(fixes, participation) },
    schema: TrackPointsResult,
  });
}
