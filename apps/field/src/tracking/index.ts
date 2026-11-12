import {
  Accuracy,
  hasStartedLocationUpdatesAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
} from 'expo-location';
import { addNetworkStateListener } from 'expo-network';
import { defineTask } from 'expo-task-manager';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { flushOutbox } from '../outbox';
import { useSession } from '../state/session';
import { noteGps } from './gpsStatus';
import { LOCATION_TASK, recordFixes, trackPointSender } from './locationTask';
import type { Fix } from './trackPoints';

/**
 * Where GPS fixes come from (TECH_STACK.md). The app talks to this interface only, so a more reliable background
 * library can replace expo-location later without touching the rest.
 */
export interface LocationTracker {
  start(): Promise<void>;
  stop(): Promise<void>;
}

// The task must be defined when the bundle loads, outside any component: the phone may start the app in the
// background to deliver fixes, with no screen mounted (expo-task-manager).
if (Platform.OS !== 'web') defineTask<{ locations: Fix[] }>(LOCATION_TASK, receiveFixes);

/**
 * The background task's handler: saves each batch on the device, then sends what waits (UC-S01). A batch the server
 * cannot take now stays in the outbox and goes out on a later trigger (`useTrackSync`).
 */
export async function receiveFixes({ data, error }: { data?: { locations: Fix[] }; error: unknown }): Promise<void> {
  // The phone could not get a location (services off, permission revoked): GPS is lost, also with the app in the
  // background, where the screens' checks do not run (decision 42).
  if (error) {
    await noteGps(false);
    return;
  }
  if (!data) return;
  // A failed save is not worth crashing the task: the next fix is saved on its own.
  await recordFixes(data.locations).catch(() => undefined);
  await syncTrack();
}

/**
 * When the server says an activity ended (it may have while the socket was down), the phone stops tracking instead of
 * sampling GPS for nothing. Another mission's answer only drops its stored points.
 */
async function stopTrackingIfCurrent(endedMissionId: string): Promise<void> {
  const { missionId, participation, updateParticipation } = useSession.getState();
  if (missionId !== endedMissionId) return;
  if (participation) updateParticipation({ ...participation, status: 'ended', taskStatus: null });
  await expoLocationTracker.stop().catch(() => undefined);
}

const trackSender = trackPointSender((missionId) => void stopTrackingIfCurrent(missionId));

/** Sends the track points that wait in the outbox. Never throws: what fails stays queued for the next trigger. */
export function syncTrack(): Promise<void> {
  return flushOutbox({ 'track-point': trackSender }).catch(() => undefined);
}

/**
 * Sends waiting track points when there is a reason to try: the session has a token, the phone gets a connection
 * again, or the app comes to the foreground. No timer: after each background delivery `receiveFixes` tries too.
 */
export function useTrackSync(): void {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (Platform.OS === 'web' || !token) return;
    void syncTrack();
    const network = addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncTrack();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncTrack();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [token]);
}

/**
 * Background GPS through expo-location. Intervals are left to the phone: the sampling rate is TBD in the spec
 * (UC-S01). shortcut: `Accuracy.High` is a provisional choice; on Android it also sets the default intervals, so
 * revisit it with the sampling rate.
 */
export const expoLocationTracker: LocationTracker = {
  start: () =>
    startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Accuracy.High,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'TRACE רושמת את המסלול שלך',
        notificationBody: 'המיקום נשלח למנהל המסע עד סיום הפעילות.',
        // A force-close ends tracking with the app (UC-S01 allows it); the commander then sees the last update.
        killServiceOnDestroy: true,
      },
    }),
  stop: async () => {
    if (await hasStartedLocationUpdatesAsync(LOCATION_TASK)) await stopLocationUpdatesAsync(LOCATION_TASK);
  },
};

/**
 * Runs the tracker from Start Search until the activity ends (decisions 43, 65), as the session says, also across a
 * move to another polygon and while paused. Starting can fail without permission; Start Search checks it (#30).
 */
export function useLocationTracking(tracker: LocationTracker = expoLocationTracker): void {
  const tracking = useSession((s) => s.tracking);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (tracking ? tracker.start() : tracker.stop()).catch(() => undefined);
  }, [tracking, tracker]);
}
