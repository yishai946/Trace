import type { LngLat } from '@trace/geo';
import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from 'expo-location';
import { useEffect, useState } from 'react';

export interface CurrentFix {
  position: LngLat;
  accuracy: number | null;
  /** Milliseconds since the epoch, when the phone took the fix. */
  at: number;
}

interface CurrentFixState {
  state: 'locating' | 'ready' | 'unavailable';
  fix: CurrentFix | null;
}

/**
 * The searcher's position, taken once when the screen opens (a sighting, UC-F10). When location is denied or the phone
 * gives no fix the state is `unavailable`, and the screen asks for a point on the map instead. With `prompt: false` it
 * never asks for permission: a screen that only uses the fix as a hint (distances, UC-F11) takes it if already granted.
 */
export function useCurrentFix({ prompt = true }: { prompt?: boolean } = {}): CurrentFixState {
  const [result, setResult] = useState<CurrentFixState>({ state: 'locating', fix: null });
  useEffect(() => {
    let active = true;
    const finish = (next: CurrentFixState) => {
      if (active) setResult(next);
    };
    void (async () => {
      try {
        let permission = await getForegroundPermissionsAsync();
        if (!permission.granted && prompt) permission = await requestForegroundPermissionsAsync();
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
  }, [prompt]);
  return result;
}
