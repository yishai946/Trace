import { getForegroundPermissionsAsync, hasServicesEnabledAsync } from 'expo-location';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';

/**
 * How often the phone checks its GPS while tracking.
 * shortcut: a technical polling interval, not the spec's escalation time (TBD, UC-S04 #88); also checked on start,
 * whenever the app comes back to the foreground, and on every location error of the background task.
 */
export const GPS_CHECK_MS = 30_000;

/** GPS works when the phone's location services are on and the app may still read the location. */
export async function hasGps(): Promise<boolean> {
  const [services, permission] = await Promise.all([hasServicesEnabledAsync(), getForegroundPermissionsAsync()]);
  return services && permission.granted;
}

/** What the server was last told, so a failed report is sent again on the next check. */
let reported: boolean | null = null;

/** Tells the API, so the commander sees "GPS unavailable" (decision 42). */
export async function reportGps(available: boolean): Promise<void> {
  const { token, missionId } = useSession.getState();
  if (!token || !missionId) return;
  await apiRequest(`/missions/${missionId}/participation/gps`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'PUT',
    body: { available },
  });
  reported = available;
}

let sending: Promise<void> | null = null;

/** Shows the state on the phone at once, and tells the server until it has it. One report at a time keeps them in order. */
export async function noteGps(available: boolean): Promise<void> {
  useSession.getState().setGpsAvailable(available);
  await sending;
  if (reported === available || useSession.getState().gpsAvailable !== available) return;
  sending = reportGps(available).catch(() => undefined);
  await sending;
  sending = null;
}

/** Forgets what was reported, for a new mission or a new session. */
export function resetGpsReport(): void {
  reported = null;
}

/**
 * While tracking, watches whether the phone has GPS (UC-S01, decision 42): the searcher is warned on the map, and the
 * commander is told on each change.
 */
export function useGpsStatus(check: () => Promise<boolean> = hasGps): void {
  const tracking = useSession((s) => s.tracking);

  useEffect(() => {
    if (!tracking || Platform.OS === 'web') {
      useSession.getState().setGpsAvailable(null);
      resetGpsReport();
      return;
    }
    let closed = false;
    const run = async () => {
      const available = await check().catch(() => false);
      if (!closed) await noteGps(available);
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
