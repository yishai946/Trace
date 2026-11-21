import { typography } from '@trace/design';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { MapProvider } from '../provider';
import { labelHalo } from './labelLayers';
import { BASE, CONTOURS, DEM } from './sources';
import type { ThemeColors } from './types';

/** The ground, woods, settlements and water. */
export function landLayers(c: ThemeColors): LayerSpecification[] {
  return [
    { id: 'background', type: 'background', paint: { 'background-color': c.mapGround } },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: BASE,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': c.inkFaint, 'fill-opacity': 0.12 },
    },
    {
      id: 'landcover-bare',
      type: 'fill',
      source: BASE,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['rock', 'sand']]],
      paint: { 'fill-color': c.inkFaint, 'fill-opacity': 0.05 },
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
      paint: { 'fill-color': c.inkFaint, 'fill-opacity': 0.1 },
    },
    {
      id: 'water',
      type: 'fill',
      source: BASE,
      'source-layer': 'water',
      paint: { 'fill-color': c.water, 'fill-opacity': 0.3 },
    },
  ];
}

interface TerrainInput {
  c: ThemeColors;
  night: boolean;
  fonts: MapProvider['fonts'];
  hillshade: boolean;
  contours: boolean;
}

/** Relief shading and elevation lines, for the options that are on. */
export function terrainLayers({ c, night, fonts, hillshade, contours }: TerrainInput): LayerSpecification[] {
  const layers: LayerSpecification[] = [];
  if (hillshade) {
    layers.push({
      id: 'hillshade',
      type: 'hillshade',
      source: DEM,
      paint: {
        'hillshade-exaggeration': night ? 0.45 : 0.35,
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
          'line-opacity': ['match', ['get', 'level'], 1, 0.55, 0.25],
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
export function featureLayers(c: ThemeColors): LayerSpecification[] {
  return [
    {
      id: 'waterway',
      type: 'line',
      source: BASE,
      'source-layer': 'waterway',
      paint: {
        'line-color': c.water,
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
      paint: { 'fill-color': c.inkFaint, 'fill-opacity': 0.25 },
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
    {
      id: 'road-minor',
      type: 'line',
      source: BASE,
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'service']]],
      paint: {
        'line-color': c.inkMuted,
        'line-opacity': 0.7,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.6],
      },
    },
    {
      id: 'road-major',
      type: 'line',
      source: BASE,
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      paint: {
        'line-color': c.inkMuted,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 15, 2.4],
      },
    },
  ];
}
