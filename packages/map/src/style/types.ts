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

export interface BuildMapStyleOptions {
  themeId: ThemeId;
  provider: MapProvider;
  terrain: TerrainOptions;
  data?: MissionMapData;
  /**
   * Overrides for platform-specific sources. On the web, maplibre-contour serves contours and a shared DEM
   * through its own protocol URLs; elsewhere the provider's DEM is used directly and contours are skipped.
   */
  contourTilesUrl?: string;
  demTilesUrl?: string;
}
