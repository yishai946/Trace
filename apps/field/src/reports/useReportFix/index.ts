import type { LngLat } from '@trace/geo';
import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from 'expo-location';
import { useEffect, useState } from 'react';

export interface ReportFix {
  position: LngLat;
  accuracy: number | null;
  /** Milliseconds since the epoch, when the phone took the fix. */
  at: number;
}

interface ReportFixState {
  state: 'locating' | 'ready' | 'unavailable';
  fix: ReportFix | null;
}

/**
 * The searcher's position for a report, taken once when the form opens (UC-F09: TRACE attaches the GPS). A report is
 * sent only with a position, so when location is denied or the phone gives no fix the state is `unavailable`.
 * shortcut: whether a report, "הנעדר אותר" in particular, may go out without a position is not in the spec; ask the
 * product owner.
 */
export function useReportFix(): ReportFixState {
  const [result, setResult] = useState<ReportFixState>({ state: 'locating', fix: null });
  useEffect(() => {
    let active = true;
    const finish = (next: ReportFixState) => {
      if (active) setResult(next);
    };
    void (async () => {
      try {
        let permission = await getForegroundPermissionsAsync();
        if (!permission.granted) permission = await requestForegroundPermissionsAsync();
        if (!permission.granted) return finish({ state: 'unavailable', fix: null });
        const { coords, timestamp } = await getCurrentPositionAsync({ accuracy: Accuracy.High });
        finish({
          state: 'ready',
          fix: { position: [coords.longitude, coords.latitude], accuracy: coords.accuracy ?? null, at: timestamp },
        });
      } catch {
        finish({ state: 'unavailable', fix: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return result;
}
