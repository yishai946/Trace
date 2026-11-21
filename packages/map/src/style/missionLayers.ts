import { themes, typography, type ThemeId } from '@trace/design';
import type { ExpressionSpecification, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { SOURCE } from '../data';
import { iconId } from '../icons';
import { sosLayers } from './sosLayers';
import type { ThemeColors } from './types';

const labelSize = typography.mapLabel.fontSize;

/** Polygons, tracks and the LKP history. */
function areaLayers(c: ThemeColors, boldFont: string[], regularFont: string[]): LayerSpecification[] {
  const status: ExpressionSpecification = ['get', 'status'];
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
  ];
}

/** The searchers on the map, with the SOS ring. */
function unitLayers(c: ThemeColors, boldFont: string[]): LayerSpecification[] {
  const state: ExpressionSpecification = ['get', 'state'];
  return [
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
  ];
}

/** Reports, sightings, the rally point and the LKP. */
function pointLayers(themeId: ThemeId, c: ThemeColors, boldFont: string[]): LayerSpecification[] {
  return [
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

/** Mission overlays from the Trace Console MapSymbols guidelines. */
export function missionLayers(themeId: ThemeId, boldFont: string[], regularFont: string[]): LayerSpecification[] {
  const c = themes[themeId].color;
  return [
    ...areaLayers(c, boldFont, regularFont),
    ...unitLayers(c, boldFont),
    ...sosLayers(c, boldFont),
    ...pointLayers(themeId, c, boldFont),
  ];
}
