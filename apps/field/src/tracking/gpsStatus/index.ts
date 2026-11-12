import { hasServicesEnabledAsync } from 'expo-location';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';

/**
 * How often the phone checks its location services while tracking.
 * shortcut: a technical polling interval, not the spec's escalation time (TBD, UC-S04 #88); also checked on start and
 * whenever the app comes back to the foreground.
 */
export const GPS_CHECK_MS = 30_000;

/** Tells the API, so the commander sees "GPS unavailable" (decision 42). A failure is tried at the next change. */
export async function reportGps(available: boolean): Promise<void> {
  const { token, missionId } = useSession.getState();
  if (!token || !missionId) return;
  await apiRequest(`/missions/${missionId}/participation/gps`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'PUT',
    body: { available },
  });
}

/**
 * While tracking, watches whether the phone's location services are on (UC-S01, decision 42): the searcher is warned on
 * the map, and the commander is told on each change.
 */
export function useGpsStatus(check: () => Promise<boolean> = hasServicesEnabledAsync): void {
  const tracking = useSession((s) => s.tracking);

  useEffect(() => {
    if (!tracking || Platform.OS === 'web') {
      useSession.getState().setGpsAvailable(null);
      return;
    }
    let closed = false;
    const run = async () => {
      const available = await check().catch(() => false);
      if (closed || useSession.getState().gpsAvailable === available) return;
      useSession.getState().setGpsAvailable(available);
      await reportGps(available).catch(() => undefined);
    };
    void run();
    const timer = setInterval(() => void run(), GPS_CHECK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      closed = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [tracking, check]);
}
