import { typography } from '@trace/design';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { MapProvider } from '../provider';
import { roadLayers } from './roadLayers';
import { labelHalo } from './labelLayers';
import { BASE, CONTOURS, DEM, SATELLITE } from './sources';
import type { ColorfulPalette } from './colorfulPalette';
import type { ThemeColors } from './types';

/** Satellite imagery over the ground color, in place of the drawn land. */
export function satelliteLayers(c: ThemeColors): LayerSpecification[] {
  return [
    { id: 'background', type: 'background', paint: { 'background-color': c.mapGround } },
    { id: 'satellite', type: 'raster', source: SATELLITE },
  ];
}

/**
 * The ground, woods, settlements and water. The black and white map paints them with the theme's tokens; the colored
 * one (a palette) like Google Maps. The day theme's tokens are faint, so its black and white shapes are drawn denser.
 */
export function landLayers(c: ThemeColors, palette: ColorfulPalette | null, night: boolean): LayerSpecification[] {
  const boost = night ? 1 : 1.9;
  return [
    { id: 'background', type: 'background', paint: { 'background-color': palette?.land ?? c.mapGround } },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: BASE,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: palette ? { 'fill-color': palette.wood } : { 'fill-color': c.inkFaint, 'fill-opacity': 0.12 * boost },
    },
    ...(palette
      ? ([
          {
            id: 'landcover-grass',
            type: 'fill',
            source: BASE,
            'source-layer': 'landcover',
            filter: ['==', ['get', 'class'], 'grass'],
            paint: { 'fill-color': palette.grass },
          },
          {
            id: 'landuse-park',
            type: 'fill',
            source: BASE,
            'source-layer': 'landuse',
            filter: ['in', ['get', 'class'], ['literal', ['park', 'garden', 'playground', 'pitch', 'cemetery']]],
            paint: { 'fill-color': palette.park },
          },
        ] satisfies LayerSpecification[])
      : []),
    {
      id: 'landcover-bare',
      type: 'fill',
      source: BASE,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['rock', 'sand']]],
      paint: { 'fill-color': c.inkFaint, 'fill-opacity': palette ? 0 : 0.05 * boost },
    },
    {
      id: 'landuse-settlement',
      type: 'fill',
      source: BASE,
      'source-layer': 'landuse',
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial']],
      ],
      paint: palette ? { 'fill-color': palette.settlement } : { 'fill-color': c.inkFaint, 'fill-opacity': 0.1 * boost },
    },
    {
      id: 'water',
      type: 'fill',
      source: BASE,
      'source-layer': 'water',
      paint: palette ? { 'fill-color': palette.water } : { 'fill-color': c.water, 'fill-opacity': 0.3 * boost },
    },
  ];
}

interface TerrainInput {
  c: ThemeColors;
  night: boolean;
  fonts: MapProvider['fonts'];
  hillshade: boolean;
  contours: boolean;
  /** The colored map: relief and contours are drawn lighter so they do not gray the colors. */
  soft: boolean;
}

/** Relief shading and elevation lines, for the options that are on. */
export function terrainLayers({ c, night, fonts, hillshade, contours, soft }: TerrainInput): LayerSpecification[] {
  const layers: LayerSpecification[] = [];
  if (hillshade) {
    layers.push({
      id: 'hillshade',
      type: 'hillshade',
      source: DEM,
      paint: {
        'hillshade-exaggeration': soft ? 0.12 : night ? 0.45 : 0.35,
        'hillshade-shadow-color': night ? c.mapHalo : c.inkSecondary,
        'hillshade-highlight-color': night ? c.inkFaint : c.surface,
        'hillshade-accent-color': night ? c.mapHalo : c.inkMuted,
      },
    });
  }
  if (contours) {
    layers.push(
      {
        id: 'contour-lines',
        type: 'line',
        source: CONTOURS,
        'source-layer': 'contours',
        paint: {
          'line-color': c.inkFaint,
          'line-opacity': ['match', ['get', 'level'], 1, soft ? 0.3 : 0.55, soft ? 0.12 : 0.25],
          'line-width': ['match', ['get', 'level'], 1, 0.8, 0.4],
        },
      },
      {
        id: 'contour-labels',
        type: 'symbol',
        source: CONTOURS,
        'source-layer': 'contours',
        filter: ['>', ['get', 'level'], 0],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ''],
          'text-font': fonts.regular,
          'text-size': typography.mapLabel.fontSize,
        },
        paint: { 'text-color': c.inkMuted, ...labelHalo(c) },
      },
    );
  }
  return layers;
}

/** Waterways, buildings, the border and the roads and paths. */
export function featureLayers(c: ThemeColors, palette: ColorfulPalette | null): LayerSpecification[] {
  return [
    {
      id: 'waterway',
      type: 'line',
      source: BASE,
      'source-layer': 'waterway',
      paint: {
        'line-color': palette?.water ?? c.water,
        'line-width': ['match', ['get', 'class'], 'river', 1.6, 0.9],
        'line-dasharray': ['case', ['==', ['get', 'intermittent'], 1], ['literal', [3, 2]], ['literal', [1, 0]]],
      },
    },
    {
      id: 'building',
      type: 'fill',
      source: BASE,
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': palette?.building ?? c.inkFaint, 'fill-opacity': palette ? 1 : 0.25 },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: BASE,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.inkMuted, 'line-width': 1, 'line-dasharray': [4, 3] },
    },
    // Paths and tracks matter most to a search: they are drawn darker than in a road map.
    {
      id: 'road-path',
      type: 'line',
      source: BASE,
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'path'],
      paint: { 'line-color': c.inkSecondary, 'line-width': 1, 'line-dasharray': [1.5, 1.5] },
    },
    {
      id: 'road-track',
      type: 'line',
      source: BASE,
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['==', ['get', 'class'], 'track'],
      paint: { 'line-color': c.inkSecondary, 'line-width': 1.2, 'line-dasharray': [4, 2] },
    },
    ...roadLayers(c, palette),
  ];
}
