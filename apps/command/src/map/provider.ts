import { maptilerProvider, type MapProvider } from '@trace/map';
import { addProtocol } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';

/** The configured map provider, or null when no key is set (the map then shows setup instructions). */
export function getMapProvider(): MapProvider | null {
  const key = import.meta.env.MAPTILER_API_KEY?.trim();
  return key ? maptilerProvider(key) : null;
}

export interface WebTerrainSources {
  demTilesUrl: string;
  contourTilesUrl: string;
}

let terrainSources: WebTerrainSources | null = null;

/**
 * Web-only elevation sources: maplibre-contour fetches each DEM tile once, shares it with hillshade and 3D terrain,
 * and generates contour lines from it in a worker. Works with any terrain-rgb provider, including self-hosted.
 */
export function getWebTerrainSources(provider: MapProvider): WebTerrainSources {
  if (terrainSources) return terrainSources;
  const dem = new mlcontour.DemSource({
    url: provider.demTilesTemplate,
    encoding: provider.demEncoding,
    maxzoom: Math.min(provider.demMaxZoom, 12),
    worker: true,
  });
  dem.setupMaplibre({ addProtocol });
  terrainSources = {
    demTilesUrl: dem.sharedDemProtocolUrl,
    contourTilesUrl: dem.contourProtocolUrl({
      // meters: [minor, major] interval per zoom
      thresholds: { 11: [100, 500], 12: [50, 250], 13: [50, 250], 14: [20, 100], 15: [10, 50] },
      elevationKey: 'ele',
      levelKey: 'level',
      contourLayer: 'contours',
    }),
  };
  return terrainSources;
}
