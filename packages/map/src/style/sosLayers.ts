import { typography } from '@trace/design';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { SOURCE } from '../data';
import type { ThemeColors } from './types';

const labelSize = typography.mapLabel.fontSize;

/** An open SOS: a red ring, a dot and its label, above the units. */
export function sosLayers(c: ThemeColors, boldFont: string[]): LayerSpecification[] {
  return [
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
  ];
}
