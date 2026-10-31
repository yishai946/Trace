import { themes, typography, type ThemeId } from '@trace/design';
import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import { emptyMissionMapData, SOURCE, toMissionSources, type MissionMapData } from './data';
import { iconId } from './icons';
import type { MapProvider } from './provider';

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

const BASE = 'trace-base';
const DEM = 'trace-dem';
const CONTOURS = 'trace-contours';

/** Hebrew name first, then the local name. */
const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:he'], ['get', 'name']];

/**
 * The Trace Console map style: a quiet topographic base, every color taken from the theme's tokens, and the
 * mission overlays from the MapSymbols guidelines on top. The design system defines no dedicated base-map palette,
 * so base layers reuse neutral tokens at low opacity, keeping color for mission meaning.
 */
export function buildMapStyle(options: BuildMapStyleOptions): StyleSpecification {
  const { themeId, provider, terrain } = options;
  const c = themes[themeId].color;
  const night = themeId === 'night';
  const fonts = provider.fonts;
  const labelSize = typography.mapLabel.fontSize;
  const halo = { 'text-halo-color': c.mapGround, 'text-halo-width': 1.4 } as const;
  const showContours = terrain.contours && !!options.contourTilesUrl;

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
  if (showContours && options.contourTilesUrl) {
    sources[CONTOURS] = { type: 'vector', tiles: [options.contourTilesUrl], maxzoom: 15 };
  }
  for (const [id, data] of Object.entries(toMissionSources(options.data ?? emptyMissionMapData))) {
    sources[id] = { type: 'geojson', data };
  }

  const base: LayerSpecification[] = [
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

  if (terrain.hillshade) {
    base.push({
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

  if (showContours) {
    base.push(
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
          'text-size': labelSize,
        },
        paint: { 'text-color': c.inkMuted, ...halo },
      },
    );
  }

  base.push(
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
    {
      id: 'label-water',
      type: 'symbol',
      source: BASE,
      'source-layer': 'waterway',
      minzoom: 12,
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': fonts.regular, 'text-size': labelSize },
      paint: { 'text-color': c.water, ...halo },
    },
    {
      id: 'label-road',
      type: 'symbol',
      source: BASE,
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': fonts.regular, 'text-size': labelSize },
      paint: { 'text-color': c.inkMuted, ...halo },
    },
    {
      id: 'label-peak',
      type: 'symbol',
      source: BASE,
      'source-layer': 'mountain_peak',
      minzoom: 11,
      filter: ['==', ['get', 'class'], 'peak'],
      layout: {
        'text-field': ['format', NAME, {}, '\n', {}, ['to-string', ['get', 'ele']], { 'font-scale': 0.9 }],
        'text-font': fonts.regular,
        'text-size': labelSize,
      },
      paint: { 'text-color': c.inkSecondary, ...halo },
    },
    {
      id: 'label-place',
      type: 'symbol',
      source: BASE,
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood']]],
      layout: {
        'text-field': NAME,
        'text-font': fonts.bold,
        'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 13, labelSize + 1],
      },
      paint: { 'text-color': c.ink, ...halo },
    },
  );

  const overlays = missionLayers(themeId, fonts.bold);

  return {
    version: 8,
    name: `Trace Console ${themeId}`,
    glyphs: provider.glyphsTemplate,
    sources,
    layers: [...base, ...overlays],
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
function missionLayers(themeId: ThemeId, boldFont: string[]): LayerSpecification[] {
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
        'line-width': ['match', status, 'active', 1.6, 1.2],
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
      id: 'mission-reports',
      type: 'symbol',
      source: SOURCE.reports,
      layout: {
        'icon-image': ['case', ['get', 'hazard'], iconId(themeId, 'hazard'), iconId(themeId, 'report')],
        'icon-allow-overlap': true,
      },
    },
    {
      id: 'mission-sightings',
      type: 'symbol',
      source: SOURCE.sightings,
      layout: { 'icon-image': iconId(themeId, 'sighting'), 'icon-allow-overlap': true },
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
