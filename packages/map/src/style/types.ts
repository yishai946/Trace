import type { themes, ThemeId } from '@trace/design';
import type { MissionMapData } from '../data';
import type { MapProvider } from '../provider';

/** The color tokens of one theme. */
export type ThemeColors = (typeof themes)[ThemeId]['color'];

export interface TerrainOptions {
  /** Relief shading from elevation data. */
  hillshade: boolean;
  /** Elevation lines. Needs `contourTilesUrl` (generated from the DEM on the client). */
  contours: boolean;
  /** Real 3D terrain; tilt the map to see it. */
  terrain3d: boolean;
}

/** The base map: the quiet topographic map, or satellite imagery under the same roads, labels and mission. */
export type MapBase = 'map' | 'satellite';
/** Black and white is the default map; color paints woods and water with the theme's own tokens. */
export type MapColor = 'bw' | 'color';

export interface MapView {
  base: MapBase;
  color: MapColor;
}

export const defaultMapView: MapView = { base: 'map', color: 'bw' };

export interface BuildMapStyleOptions {
  themeId: ThemeId;
  provider: MapProvider;
  terrain: TerrainOptions;
  /** Defaults to the black and white map. */
  view?: MapView;
  data?: MissionMapData;
  /**
   * Overrides for platform-specific sources. On the web, maplibre-contour serves contours and a shared DEM
   * through its own protocol URLs; elsewhere the provider's DEM is used directly and contours are skipped.
   */
  contourTilesUrl?: string;
  demTilesUrl?: string;
}
