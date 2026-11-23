import type { SourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import { emptyMissionMapData, toMissionSources } from '../data';
import { defaultMapView, type BuildMapStyleOptions } from './types';

export const BASE = 'trace-base';
export const DEM = 'trace-dem';
export const CONTOURS = 'trace-contours';
export const SATELLITE = 'trace-satellite';

/** Whether the satellite base is drawn: it is asked for and the provider has imagery. */
export const showsSatellite = ({ view = defaultMapView, provider }: BuildMapStyleOptions) =>
  view.base === 'satellite' && !!provider.satelliteTilesTemplate;

/** Whether the contour lines can be drawn: they are asked for and a contour tile URL exists. */
export const showsContours = ({ terrain, contourTilesUrl }: BuildMapStyleOptions) =>
  terrain.contours && !!contourTilesUrl;

/** The vector base, the elevation tiles, the contours when shown, and the mission data as GeoJSON. */
export function mapSources(options: BuildMapStyleOptions): Record<string, SourceSpecification> {
  const { provider } = options;
  const sources: Record<string, SourceSpecification> = {
    [BASE]: { type: 'vector', url: provider.vectorTilesUrl },
    [DEM]: {
      type: 'raster-dem',
      tiles: [options.demTilesUrl ?? provider.demTilesTemplate],
      encoding: provider.demEncoding,
      tileSize: 256,
      maxzoom: provider.demMaxZoom,
    },
  };
  if (showsSatellite(options) && options.provider.satelliteTilesTemplate) {
    sources[SATELLITE] = {
      type: 'raster',
      tiles: [options.provider.satelliteTilesTemplate],
      tileSize: 256,
      maxzoom: options.provider.satelliteMaxZoom ?? 18,
    };
  }
  if (showsContours(options) && options.contourTilesUrl) {
    sources[CONTOURS] = { type: 'vector', tiles: [options.contourTilesUrl], maxzoom: 15 };
  }
  for (const [id, data] of Object.entries(toMissionSources(options.data ?? emptyMissionMapData))) {
    sources[id] = { type: 'geojson', data };
  }
  return sources;
}
