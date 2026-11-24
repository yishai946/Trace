import { maptilerProvider, type MapProvider } from '@trace/map';
import type * as MapLibre from '@maplibre/maplibre-react-native';

export type MapLibreModule = typeof MapLibre;

/** MapTiler client key (public, restricted to the app in MapTiler's settings). Set in `apps/field/.env.local`. */
const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim();

/** The map's tile source; null when the key is not set. */
export const mapProvider: MapProvider | null = mapTilerKey ? maptilerProvider(mapTilerKey) : null;

/**
 * MapLibre Native is a native module: it is missing from Expo Go, on web and in tests, and importing it there throws
 * at load time, which would take the whole route down. Load it lazily; null when it is not there.
 */
export function loadMapLibre(): MapLibreModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily: the native module is missing on web and in tests
    return require('@maplibre/maplibre-react-native');
  } catch {
    return null;
  }
}

// MapLibre Native has no client-side contour generation and 3D is an open decision (TECH_STACK.md): relief only.
export const mapTerrain = { hillshade: true, contours: false, terrain3d: false };
