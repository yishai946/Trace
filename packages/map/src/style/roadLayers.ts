import type {
  ExpressionSpecification,
  LayerSpecification,
  LineLayerSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { ColorfulPalette } from './colorfulPalette';
import { BASE } from './sources';
import type { ThemeColors } from './types';

const MINOR = ['secondary', 'tertiary', 'minor', 'service'];
const MAJOR = ['motorway', 'trunk', 'primary'];
const widths = (low: number, high: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  low,
  15,
  high,
];

/** Streets and highways. The colored map draws each with a casing, like Google Maps; the other one a single line. */
export function roadLayers(c: ThemeColors, palette: ColorfulPalette | null): LayerSpecification[] {
  const road = (id: string, classes: string[], paint: LineLayerSpecification['paint']): LayerSpecification => ({
    id,
    type: 'line',
    source: BASE,
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint,
  });

  if (!palette) {
    return [
      road('road-minor', MINOR, {
        'line-color': c.inkMuted,
        'line-opacity': 0.7,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.6],
      }),
      road('road-major', MAJOR, { 'line-color': c.inkMuted, 'line-width': widths(0.8, 2.4) }),
    ];
  }
  return [
    road('road-minor-casing', MINOR, {
      'line-color': palette.roadCasing,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 5],
    }),
    road('road-minor', MINOR, {
      'line-color': palette.roadMinor,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 3.6],
    }),
    road('road-major-casing', MAJOR, { 'line-color': palette.roadMajorCasing, 'line-width': widths(2, 8) }),
    road('road-major', MAJOR, { 'line-color': palette.roadMajor, 'line-width': widths(1.2, 5.6) }),
  ];
}
