import type { Bounds } from '@trace/geo';

/**
 * Where map data comes from. The style only depends on these URLs, so moving from MapTiler to self-hosted tiles
 * (PMTiles in the same OpenMapTiles schema, a DEM in terrain-rgb) means writing another provider, not a new style.
 */
export interface MapProvider {
  id: string;
  /** TileJSON of vector tiles in the OpenMapTiles schema. */
  vectorTilesUrl: string;
  /** `{z}/{x}/{y}` template of elevation tiles, used for hillshade, contours and 3D terrain. */
  demTilesTemplate: string;
  demEncoding: 'mapbox' | 'terrarium';
  demMaxZoom: number;
  /** `{fontstack}/{range}` template of glyph PBFs. The fonts must include Hebrew. */
  glyphsTemplate: string;
  fonts: { regular: string[]; bold: string[] };
  /** Forward geocoding (place and address search). */
  geocodingUrl?: (query: string) => string;
}

/** Israel and the territories, for limiting place search. */
export const ISRAEL_BOUNDS: Bounds = [34.2, 29.4, 35.95, 33.4];

export function maptilerProvider(apiKey: string): MapProvider {
  const key = encodeURIComponent(apiKey);
  return {
    id: 'maptiler',
    vectorTilesUrl: `https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=${key}`,
    demTilesTemplate: `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`,
    demEncoding: 'mapbox',
    demMaxZoom: 14,
    glyphsTemplate: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
    fonts: { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'] },
    // MapTiler's country filter drops Israeli results; a bounding box works.
    geocodingUrl: (query) =>
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
      `?language=he&bbox=${ISRAEL_BOUNDS.join(',')}&limit=6&key=${key}`,
  };
}
