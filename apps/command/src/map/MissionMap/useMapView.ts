import type { MapView } from '@trace/map';
import { useMemo, useState } from 'react';
import { readMapView, saveMapView } from '../mapView';

/**
 * The map view the commander chose, saved on this device. When the satellite imagery fails to load the map shows its
 * base map instead, without overwriting the choice, until the commander picks a view again.
 */
export function useMapView() {
  const [chosen, setChosen] = useState(readMapView);
  const [satelliteFailed, setSatelliteFailed] = useState(false);
  // Stable between renders: the style is rebuilt whenever this object changes, and the map rerenders on every mousemove.
  const view = useMemo<MapView>(
    () => (satelliteFailed ? { ...chosen, base: 'map' } : chosen),
    [chosen, satelliteFailed],
  );

  const change = (next: MapView) => {
    setSatelliteFailed(false);
    setChosen(next);
    saveMapView(next);
  };
  return { view, change, satelliteFailed, onSatelliteError: () => setSatelliteFailed(true) };
}
