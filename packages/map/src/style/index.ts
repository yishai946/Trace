import { themes } from '@trace/design';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { featureLayers, landLayers, terrainLayers } from './baseLayers';
import { labelLayers } from './labelLayers';
import { missionLayers } from './missionLayers';
import { DEM, mapSources, showsContours } from './sources';
import type { BuildMapStyleOptions } from './types';

export type { BuildMapStyleOptions, TerrainOptions } from './types';

/**
 * The Trace Console map style: a quiet topographic base, every color taken from the theme's tokens, and the
 * mission overlays from the MapSymbols guidelines on top. The design system defines no dedicated base-map palette,
 * so base layers reuse neutral tokens at low opacity, keeping color for mission meaning.
 */
export function buildMapStyle(options: BuildMapStyleOptions): StyleSpecification {
  const { themeId, provider, terrain } = options;
  const c = themes[themeId].color;
  const { fonts } = provider;

  return {
    version: 8,
    name: `Trace Console ${themeId}`,
    glyphs: provider.glyphsTemplate,
    sources: mapSources(options),
    // The order is the drawing order: ground, relief, features, labels, then the mission on top.
    layers: [
      ...landLayers(c),
      ...terrainLayers({
        c,
        night: themeId === 'night',
        fonts,
        hillshade: terrain.hillshade,
        contours: showsContours(options),
      }),
      ...featureLayers(c),
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

/** Mission overlays from the Trace Console MapSymbols guidelines. */
function missionLayers(themeId: ThemeId, boldFont: string[], regularFont: string[]): LayerSpecification[] {
  const c = themes[themeId].color;
  const labelSize = typography.mapLabel.fontSize;
  const status: ExpressionSpecification = ['get', 'status'];
  const state: ExpressionSpecification = ['get', 'state'];

  return [
    {
      id: 'mission-polygon-fill',
      type: 'fill',
      source: SOURCE.polygons,
      paint: {
        'fill-color': ['match', status, 'active', c.accent, c.inkMuted],
        'fill-opacity': ['match', status, 'active', 0.1, 'completed', 0.08, 0],
      },
    },
    {
      id: 'mission-polygon-line',
      type: 'line',
      source: SOURCE.polygons,
      paint: {
        'line-color': ['match', status, 'active', c.accent, 'completed', c.inkMuted, c.ink],
        'line-width': ['case', ['get', 'selected'], 2.8, ['match', status, 'active', 1.6, 1.2]],
        'line-dasharray': ['match', status, 'unassigned', ['literal', [5, 4]], ['literal', [1, 0]]],
      },
    },
    {
      id: 'mission-tracks',
      type: 'line',
      source: SOURCE.tracks,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': c.accent, 'line-width': 1.3, 'line-opacity': 0.45 },
    },
    {
      id: 'mission-lkp-history',
      type: 'circle',
      source: SOURCE.lkpHistory,
      paint: {
        'circle-radius': 3.5,
        'circle-color': c.mapGround,
        'circle-opacity': 0,
        'circle-stroke-color': c.inkFaint,
        'circle-stroke-width': 1.2,
      },
    },
    {
      id: 'mission-lkp-history-label',
      type: 'symbol',
      source: SOURCE.lkpHistory,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': regularFont,
        'text-size': labelSize,
        'text-anchor': 'left',
        'text-offset': [0.8, 0],
      },
      paint: { 'text-color': c.inkMuted, 'text-halo-color': c.mapHalo, 'text-halo-width': 1.5 },
    },
    {
      id: 'mission-polygon-label',
      type: 'symbol',
      source: SOURCE.polygons,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-padding': 4,
      },
      paint: { 'text-color': c.ink, 'text-halo-color': c.surface, 'text-halo-width': 2.5 },
    },
    {
      id: 'mission-units-sos-ring',
      type: 'circle',
      source: SOURCE.units,
      filter: ['==', state, 'sos'],
      paint: {
        'circle-radius': 13,
        'circle-color': c.danger,
        'circle-opacity': 0.18,
        'circle-stroke-color': c.danger,
        'circle-stroke-width': 1.2,
      },
    },
    {
      id: 'mission-units',
      type: 'circle',
      source: SOURCE.units,
      paint: {
        'circle-radius': 5,
        'circle-color': ['match', state, 'warning', c.warning, 'sos', c.danger, c.accent],
        'circle-opacity': ['match', state, 'offline', 0, 1],
        'circle-stroke-color': ['match', state, 'offline', c.inkMuted, c.mapHalo],
        'circle-stroke-width': ['match', state, 'offline', 1.5, 2],
      },
    },
    {
      id: 'mission-units-label',
      type: 'symbol',
      source: SOURCE.units,
      layout: {
        'text-field': ['get', 'callsign'],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-anchor': 'right',
        'text-offset': ['match', state, 'sos', ['literal', [-1.6, 0]], ['literal', [-0.8, 0]]],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': ['match', state, 'warning', c.warning, 'sos', c.danger, 'offline', c.inkMuted, c.ink],
        'text-halo-color': c.mapHalo,
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'mission-sos-ring',
      type: 'circle',
      source: SOURCE.sos,
      paint: {
        'circle-radius': 18,
        'circle-color': c.danger,
        'circle-opacity': 0.18,
        'circle-stroke-color': c.danger,
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'mission-sos',
      type: 'circle',
      source: SOURCE.sos,
      paint: {
        'circle-radius': 6,
        'circle-color': c.danger,
        'circle-stroke-color': c.mapHalo,
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'mission-sos-label',
      type: 'symbol',
      source: SOURCE.sos,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.8],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.onDanger, 'text-halo-color': c.danger, 'text-halo-width': 3 },
    },
    {
      id: 'mission-reports',
      type: 'symbol',
      source: SOURCE.reports,
      layout: {
        'icon-image': [
          'case',
          ['get', 'located'],
          iconId(themeId, 'located'),
          ['get', 'hazard'],
          iconId(themeId, 'hazard'),
          iconId(themeId, 'report'),
        ],
        'icon-allow-overlap': true,
        // The flag of a located report: its time, like the LKP label.
        'text-field': ['get', 'label'],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.6],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.mapHalo, 'text-halo-color': c.ink, 'text-halo-width': 3 },
    },
    {
      id: 'mission-sightings-suggest',
      type: 'symbol',
      source: SOURCE.sightings,
      filter: ['==', ['get', 'suggested'], true],
      layout: { 'icon-image': iconId(themeId, 'suggest'), 'icon-allow-overlap': true },
    },
    {
      id: 'mission-sightings',
      type: 'symbol',
      source: SOURCE.sightings,
      layout: {
        'icon-image': iconId(themeId, 'sighting'),
        'icon-allow-overlap': true,
        // The number and time; a suggested sighting also says so under it (MapSymbols tag).
        'text-field': ['case', ['get', 'suggested'], ['concat', ['get', 'label'], '\n', 'הצעת LKP'], ['get', 'label']],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-anchor': 'right',
        'text-offset': [-1.2, 0],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.ink, 'text-halo-color': c.surface, 'text-halo-width': 2.5 },
    },
    {
      id: 'mission-rally',
      type: 'symbol',
      source: SOURCE.rally,
      layout: { 'icon-image': iconId(themeId, 'rally'), 'icon-allow-overlap': true },
    },
    {
      id: 'mission-lkp',
      type: 'symbol',
      source: SOURCE.lkp,
      layout: {
        'icon-image': iconId(themeId, 'lkp'),
        'icon-allow-overlap': true,
        'text-field': ['get', 'label'],
        'text-font': boldFont,
        'text-size': labelSize,
        'text-anchor': 'right',
        'text-offset': [-1.6, 0],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.mapHalo, 'text-halo-color': c.ink, 'text-halo-width': 3 },
    },
  ];
}
