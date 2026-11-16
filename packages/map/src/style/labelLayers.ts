import { typography } from '@trace/design';
import type { ExpressionSpecification, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { MapProvider } from '../provider';
import { BASE } from './sources';
import type { ThemeColors } from './types';

/** Hebrew name first, then the local name. */
const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:he'], ['get', 'name']];

/** The halo that keeps a label legible over the base map. */
export const labelHalo = (c: ThemeColors) => ({ 'text-halo-color': c.mapGround, 'text-halo-width': 1.4 }) as const;

/** The names of waterways, roads, peaks and places. */
export function labelLayers(c: ThemeColors, fonts: MapProvider['fonts']): LayerSpecification[] {
  const labelSize = typography.mapLabel.fontSize;
  const halo = labelHalo(c);
  return [
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
  ];
}
