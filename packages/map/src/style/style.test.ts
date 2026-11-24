import { validateStyleMin, type SymbolLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { themeIds, themes } from '@trace/design';
import { describe, expect, it } from 'vitest';
import { buildMapStyle } from '.';
import { colorfulPalette } from './colorfulPalette';
import { SOURCE } from '../data';
import { sampleData } from '../fixtures';
import { iconId, mapIcons } from '../icons';
import { maptilerProvider } from '../provider';

const provider = maptilerProvider('test-key');
const allTerrain = { hillshade: true, contours: true, terrain3d: true };

/** Every color string anywhere in the style, e.g. paint values and expression outputs. */
function colorsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string' && /^(#|rgba?\()/.test(value)) found.add(value);
  else if (Array.isArray(value)) value.forEach((v) => colorsIn(v, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => colorsIn(v, found));
  return found;
}

describe.each(themeIds)('map style (%s)', (themeId) => {
  const style = buildMapStyle({
    themeId,
    provider,
    terrain: allTerrain,
    data: sampleData,
    contourTilesUrl: 'dem-contour://{z}/{x}/{y}',
  });

  it('is a valid MapLibre style', () => {
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('uses only colors from the theme tokens', () => {
    const tokens = new Set(Object.values(themes[themeId].color));
    const layerColors = colorsIn(style.layers);
    expect(layerColors.size).toBeGreaterThan(5);
    for (const color of layerColors) expect(tokens, `${color} is not a ${themeId} token`).toContain(color);
  });

  it('references only icons that exist for the theme', () => {
    const icons = mapIcons(themeId);
    const used = JSON.stringify(style.layers).match(/trace-[a-z]+-(night|day)/g) ?? [];
    for (const id of used) expect(icons[id], id).toBeDefined();
    expect(Object.keys(icons)).toContain(iconId(themeId, 'lkp'));
  });

  it('dims past LKPs, highlights the current one and draws sightings between them', () => {
    const c = themes[themeId].color;
    const layer = (id: string) => style.layers.find((l) => l.id === id);
    const ids = style.layers.map((l) => l.id);
    expect(layer('mission-lkp-history')?.paint).toMatchObject({
      'circle-stroke-color': c.inkFaint,
      'circle-opacity': 0,
    });
    expect(layer('mission-lkp-history-label')?.paint).toMatchObject({ 'text-color': c.inkMuted });
    expect(layer('mission-lkp')?.paint).toMatchObject({ 'text-color': c.mapHalo, 'text-halo-color': c.ink });
    expect(layer('mission-sightings-suggest')).toBeDefined();
    const order = ['mission-lkp-history', 'mission-sightings-suggest', 'mission-sightings', 'mission-lkp'];
    expect(order.map((id) => ids.indexOf(id))).toEqual([...order.map((id) => ids.indexOf(id))].sort((a, b) => a - b));
    expect(order.every((id) => ids.includes(id))).toBe(true);
  });

  it('draws reports with the located, hazard or plain symbol and a flag for a located one', () => {
    const c = themes[themeId].color;
    const layer = style.layers.find((l) => l.id === 'mission-reports') as SymbolLayerSpecification | undefined;
    expect(layer?.type).toBe('symbol');
    const layout = layer?.layout;
    expect(layout?.['icon-image']).toEqual([
      'case',
      ['get', 'located'],
      iconId(themeId, 'located'),
      ['get', 'hazard'],
      iconId(themeId, 'hazard'),
      iconId(themeId, 'report'),
    ]);
    expect(layout?.['text-field']).toEqual(['get', 'label']);
    expect(layer?.paint).toMatchObject({
      'text-color': c.mapHalo,
      'text-halo-color': c.ink,
    });
  });

  it('draws an SOS in the danger color with a ring and its label', () => {
    const c = themes[themeId].color;
    const ids = style.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['mission-sos-ring', 'mission-sos', 'mission-sos-label']));
    expect(style.layers.find((l) => l.id === 'mission-sos')?.paint).toMatchObject({ 'circle-color': c.danger });
    expect(style.layers.find((l) => l.id === 'mission-sos-label')?.paint).toMatchObject({ 'text-color': c.onDanger });
    expect(ids.indexOf('mission-sos')).toBeGreaterThan(ids.indexOf('mission-units'));
  });

  it('includes terrain, contours and every mission overlay', () => {
    expect(style.terrain).toBeDefined();
    const sources = Object.keys(style.sources);
    for (const id of Object.values(SOURCE)) expect(sources).toContain(id);
    const ids = style.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['hillshade', 'contour-lines', 'mission-units', 'mission-lkp']));
  });
});

describe('map style options', () => {
  it('drops hillshade, contours and 3D when turned off', () => {
    const style = buildMapStyle({
      themeId: 'day',
      provider,
      terrain: { hillshade: false, contours: false, terrain3d: false },
    });
    const ids = style.layers.map((l) => l.id);
    expect(ids).not.toContain('hillshade');
    expect(ids).not.toContain('contour-lines');
    expect(style.terrain).toBeUndefined();
  });

  it('skips contours when no contour tile source is available (e.g. React Native)', () => {
    const style = buildMapStyle({ themeId: 'day', provider, terrain: allTerrain });
    expect(style.layers.map((l) => l.id)).not.toContain('contour-lines');
  });
});

const views = [
  { base: 'map', color: 'bw' },
  { base: 'map', color: 'color' },
  { base: 'satellite', color: 'bw' },
] as const;

describe.each(themeIds.flatMap((themeId) => views.map((view) => ({ themeId, view }))))(
  'map view $view.base/$view.color ($themeId)',
  ({ themeId, view }) => {
    const style = buildMapStyle({ themeId, provider, terrain: allTerrain, data: sampleData, view });
    const ids = style.layers.map((l) => l.id);

    it('is valid and uses only theme colors', () => {
      expect(validateStyleMin(style)).toEqual([]);
      // The colored map has its own Google-style palette; every other color is a token.
      const tokens = new Set([
        ...Object.values(themes[themeId].color),
        ...(view.color === 'color' ? Object.values(colorfulPalette[themeId]) : []),
      ]);
      for (const color of colorsIn(style.layers)) expect(tokens).toContain(color);
    });

    it('keeps the mission overlays and the labels in every view', () => {
      expect(ids).toContain('mission-polygon-fill');
      expect(ids).toContain('mission-lkp');
      expect(ids).toContain('road-major');
    });

    it('draws imagery only for the satellite base, under the roads and the mission', () => {
      const satellite = ids.indexOf('satellite');
      if (view.base !== 'satellite') {
        expect(satellite).toBe(-1);
        expect(style.sources['trace-satellite']).toBeUndefined();
        expect(ids).toContain('landcover-wood');
        return;
      }
      expect(satellite).toBeGreaterThan(ids.indexOf('background'));
      expect(satellite).toBeLessThan(ids.indexOf('road-major'));
      expect(satellite).toBeLessThan(ids.indexOf('mission-polygon-fill'));
      expect(ids).not.toContain('landcover-wood');
      expect(ids).not.toContain('hillshade');
      expect(style.sources['trace-satellite']).toMatchObject({ type: 'raster', maxzoom: provider.satelliteMaxZoom });
    });

    it('colors woods and water only in the colored map', () => {
      if (view.base === 'satellite') return;
      const wood = style.layers.find((l) => l.type === 'fill' && l.id === 'landcover-wood');
      const color = wood?.type === 'fill' ? wood.paint?.['fill-color'] : undefined;
      expect(color).toBe(view.color === 'color' ? colorfulPalette[themeId].wood : themes[themeId].color.inkFaint);
    });
  },
);

describe('map view default', () => {
  it('is the black and white map', () => {
    const withView = buildMapStyle({
      themeId: 'day',
      provider,
      terrain: allTerrain,
      view: { base: 'map', color: 'bw' },
    });
    const without = buildMapStyle({ themeId: 'day', provider, terrain: allTerrain });
    expect(without).toEqual(withView);
  });
});

describe.each(themeIds)('colored map style (%s)', (themeId) => {
  const build = (color: 'bw' | 'color') =>
    buildMapStyle({ themeId, provider, terrain: allTerrain, view: { base: 'map', color } });
  const paint = (color: 'bw' | 'color', id: string) => build(color).layers.find((l) => l.id === id)?.paint;

  it('paints woods and water with their own opaque colors, unlike the black and white map', () => {
    expect(paint('color', 'water')).not.toEqual(paint('bw', 'water'));
    expect(paint('color', 'landcover-wood')).not.toHaveProperty('fill-opacity');
    expect(paint('bw', 'landcover-wood')).toHaveProperty('fill-opacity');
  });

  it('is a valid MapLibre style', () => {
    expect(validateStyleMin(build('color'))).toEqual([]);
  });
});

describe('satellite map style', () => {
  it('keeps the imagery visible: buildings stay translucent even when the colored map is chosen', () => {
    const style = buildMapStyle({
      themeId: 'night',
      provider,
      terrain: allTerrain,
      view: { base: 'satellite', color: 'color' },
    });
    expect(style.layers.find((l) => l.id === 'building')?.paint).toMatchObject({ 'fill-opacity': 0.25 });
  });
});
