import { themes } from '@trace/design';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { featureLayers, landLayers, satelliteLayers, terrainLayers } from './baseLayers';
import { colorfulPalette } from './colorfulPalette';
import { labelLayers } from './labelLayers';
import { missionLayers } from './missionLayers';
import { DEM, mapSources, showsContours, showsSatellite } from './sources';
import { defaultMapView, type BuildMapStyleOptions } from './types';

export { colorfulPalette, type ColorfulPalette } from './colorfulPalette';
export { defaultMapView } from './types';
export { SATELLITE as SATELLITE_SOURCE } from './sources';
export type { BuildMapStyleOptions, MapBase, MapColor, MapView, TerrainOptions } from './types';

/**
 * The Trace Console map style: a quiet topographic base, every color taken from the theme's tokens, and the
 * mission overlays from the MapSymbols guidelines on top. The design system defines no dedicated base-map palette,
 * so base layers reuse neutral tokens at low opacity, keeping color for mission meaning.
 */
export function buildMapStyle(options: BuildMapStyleOptions): StyleSpecification {
  const { themeId, provider, terrain } = options;
  const c = themes[themeId].color;
  const { fonts } = provider;
  const view = options.view ?? defaultMapView;
  const satellite = showsSatellite(options);
  const palette = view.color === 'color' && !satellite ? colorfulPalette[themeId] : null;

  return {
    version: 8,
    name: `Trace Console ${themeId}`,
    glyphs: provider.glyphsTemplate,
    sources: mapSources(options),
    // The order is the drawing order: ground, relief, features, labels, then the mission on top.
    layers: [
      ...(satellite ? satelliteLayers(c) : landLayers(c, palette, themeId === 'night')),
      ...terrainLayers({
        c,
        night: themeId === 'night',
        fonts,
        // Imagery already carries the relief.
        hillshade: terrain.hillshade && !satellite,
        contours: showsContours(options),
        soft: !!palette,
      }),
      ...featureLayers(c, palette),
      ...labelLayers(c, fonts),
      ...missionLayers(themeId, fonts.bold, fonts.regular),
    ],
    // Seen above the horizon when the map is tilted.
    sky: {
      'sky-color': c.surface,
      'horizon-color': c.mapGround,
      'fog-color': c.mapGround,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.85,
    },
    ...(terrain.terrain3d ? { terrain: { source: DEM, exaggeration: 1.4 } } : {}),
  };
}
