import {
  Accuracy,
  hasStartedLocationUpdatesAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
} from 'expo-location';
import { defineTask } from 'expo-task-manager';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSession } from '../state/session';
import { LOCATION_TASK, uploadFixes } from './locationTask';
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
if (Platform.OS !== 'web') {
  defineTask<{ locations: Fix[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    await uploadFixes(data.locations).catch(() => undefined);
  });
}

/**
 * Background GPS through expo-location. Intervals are left to the phone: the sampling rate is TBD in the spec
 * (UC-S01). The accuracy is the one a search needs (about 10 m).
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
