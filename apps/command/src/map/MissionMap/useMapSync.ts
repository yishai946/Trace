import type { ThemeId } from '@trace/design';
import type { LngLat, Bounds } from '@trace/geo';
import { toMissionSources, type MissionMapData, type TerrainOptions } from '@trace/map';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { useEffect, type RefObject } from 'react';
import type { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { DRAW_PREFIX } from './createDraw';
import { drawStyles, selectStyles } from './drawStyles';

/** Screen pixels kept free around a place when zooming to it: camera behavior, not a design value. */
export const FIT_BOUNDS_PADDING_PX = 80;

interface MapSyncInput {
  mapRef: RefObject<MapLibreMap | null>;
  drawRef: RefObject<TerraDraw | null>;
  ready: boolean;
  themeId: ThemeId;
  terrain: TerrainOptions;
  data: MissionMapData;
  /** Moves the map, e.g. to a place-search result. A new object triggers a new move. */
  focus: { center: LngLat; bounds?: Bounds } | null | undefined;
  /** Builds the map style from the current props. */
  style: () => StyleSpecification;
}

/** Applies what changes after the map was created: the style, the mission data and where the map looks. */
export function useMapSync({ mapRef, drawRef, ready, themeId, terrain, data, focus, style }: MapSyncInput) {
  // Theme and terrain change the style. Keep Terra Draw's own layers across the swap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(style(), {
      diff: true,
      transformStyle: (previous, next) => ({
        ...next,
        sources: {
          ...next.sources,
          ...Object.fromEntries(Object.entries(previous?.sources ?? {}).filter(([id]) => id.startsWith(DRAW_PREFIX))),
        },
        layers: [...next.layers, ...(previous?.layers ?? []).filter((l) => l.id.startsWith(DRAW_PREFIX))],
      }),
    });
    drawRef.current?.updateModeOptions<typeof TerraDrawPolygonMode>('polygon', { styles: drawStyles(themeId) });
    drawRef.current?.updateModeOptions<typeof TerraDrawSelectMode>('select', { styles: selectStyles(themeId) });
    map.easeTo({ pitch: terrain.terrain3d ? 55 : 0, duration: 600 });
    // `style` reads the latest props through a ref, so it is not a dependency.
  }, [mapRef, drawRef, ready, themeId, terrain]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mission data updates only replace the overlay sources' data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [id, collection] of Object.entries(toMissionSources(data))) {
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(collection);
    }
  }, [mapRef, ready, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    if (focus.bounds) map.fitBounds(focus.bounds, { padding: FIT_BOUNDS_PADDING_PX, maxZoom: 15, duration: 900 });
    else map.flyTo({ center: focus.center, zoom: 14, duration: 900 });
  }, [mapRef, ready, focus]);
}
