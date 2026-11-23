import { defaultMapView, type MapView } from '@trace/map';

const STORAGE_KEY = 'trace.mapView';

const BASES: MapView['base'][] = ['map', 'satellite'];
const COLORS: MapView['color'][] = ['bw', 'color'];

/** A saved choice, field by field: a damaged or unknown value falls back to the default map. */
export function parseMapView(raw: string | null): MapView {
  let value: unknown = null;
  try {
    value = raw ? JSON.parse(raw) : null;
  } catch {
    // A damaged value is the same as none.
  }
  const saved = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
  const base = 'base' in saved ? BASES.find((b) => b === saved.base) : undefined;
  const color = 'color' in saved ? COLORS.find((c) => c === saved.color) : undefined;
  return { base: base ?? defaultMapView.base, color: color ?? defaultMapView.color };
}

/** The map view chosen on this device, kept across reloads and missions. */
export function readMapView(): MapView {
  try {
    return parseMapView(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be blocked; the default map is fine.
    return defaultMapView;
  }
}

export function saveMapView(view: MapView) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Not persisting is fine.
  }
}
