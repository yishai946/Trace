import type { LngLat } from '@trace/geo';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef, type RefObject } from 'react';
import styles from './MissionMap.module.css';

/** The commander's own position as a blue dot, as in Google Maps, once "my location" has found it. */
export function useCommanderMarker(mapRef: RefObject<MapLibreMap | null>, ready: boolean, position: LngLat | null) {
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !position) return;
    if (!marker.current) {
      const dot = document.createElement('div');
      dot.className = styles.me ?? '';
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', 'המיקום שלי');
      marker.current = new Marker({ element: dot }).setLngLat(position).addTo(map);
    } else {
      marker.current.setLngLat(position);
    }
  }, [mapRef, ready, position]);

  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [],
  );
}
