import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useState, type RefObject } from 'react';

/** The map's rotation in degrees, kept current while the user turns it, for the compass. */
export function useBearing(mapRef: RefObject<MapLibreMap | null>, ready: boolean) {
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const update = () => setBearing(map.getBearing());
    map.on('rotate', update);
    return () => void map.off('rotate', update);
  }, [mapRef, ready]);
  return bearing;
}
