import type { LngLat } from '@trace/geo';
import type { MissionMapData } from '@trace/map';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RefObject } from 'react';
import { useBearing } from './useBearing';
import { useCommanderMarker } from './useCommanderMarker';
import { moveMapTo } from './useMapSync';
import { useMyLocation } from './useMyLocation';

/** What the map's navigation column does: compass, my location (and its dot), the last LKP, the rally point and zoom. */
export function useNavControls(mapRef: RefObject<MapLibreMap | null>, data: MissionMapData, ready: boolean) {
  const bearing = useBearing(mapRef, ready);
  const flyTo = (center: LngLat) => mapRef.current && moveMapTo(mapRef.current, { center });
  const myLocation = useMyLocation(flyTo);
  useCommanderMarker(mapRef, ready, myLocation.position);
  const { lkp, rally } = data;

  return {
    locationFailed: myLocation.failed,
    nav: {
      bearing,
      onResetNorth: () => mapRef.current?.easeTo({ bearing: 0, pitch: 0 }),
      onTurn: (degrees: number) => mapRef.current?.easeTo({ bearing: mapRef.current.getBearing() + degrees }),
      onZoomIn: () => mapRef.current?.zoomIn(),
      onZoomOut: () => mapRef.current?.zoomOut(),
      onMyLocation: myLocation.locate,
      locating: myLocation.pending,
      onLkp: lkp ? () => flyTo(lkp.position) : undefined,
      onRally: rally ? () => flyTo(rally) : undefined,
    },
  };
}
