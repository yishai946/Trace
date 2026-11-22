import { getBatteryLevelAsync } from 'expo-battery';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';

/**
 * How long the same level is not sent again.
 * shortcut: a technical interval, not a spec value; the low-battery threshold and its alert are TBD (UC-S04 #87).
 */
export const BATTERY_REPORT_MS = 5 * 60_000;

/** What the server was last told, so an unchanged level is not sent on every batch of GPS points. */
let reported: { participantId: string; missionId: string; level: number; at: number } | null = null;

/** Forgets what was reported (a new mission or participant is told apart by its ids). */
export function resetBatteryReport(): void {
  reported = null;
}

/**
 * Tells the API the phone's battery level, so the commander sees it (UC-C10, decision 13). Sent together with the GPS
 * points. An unknown level (-1) is skipped. Never throws: a failed report is sent again with the next batch.
 */
export async function reportBattery(readLevel: () => Promise<number> = getBatteryLevelAsync): Promise<void> {
  const { token, missionId, participation } = useSession.getState();
  if (!token || !missionId || !participation || participation.status === 'ended') return;
  try {
    const fraction = await readLevel();
    if (!(fraction >= 0)) return;
    const level = Math.round(fraction * 100);
    const now = Date.now();
    if (
      reported?.participantId === participation.id &&
      reported.missionId === missionId &&
      reported.level === level &&
      now - reported.at < BATTERY_REPORT_MS
    )
      return;
    await apiRequest(`/missions/${missionId}/participation/battery`, {
      baseUrl: apiBaseUrl,
      token,
      method: 'PUT',
      body: { level, measuredAt: new Date(now).toISOString() },
    });
    reported = { participantId: participation.id, missionId, level, at: now };
  } catch {
    // The next batch tries again.
  }
}
