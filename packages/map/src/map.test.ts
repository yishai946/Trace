import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { themeIds, themes } from '@trace/design';
import { describe, expect, it } from 'vitest';
import { SOURCE, toMissionSources, type MissionMapData } from './data';
import { ICON_PIXEL_RATIO, iconId, mapIcons } from './icons';
import { maptilerProvider } from './provider';
import { buildMapStyle } from './style';

const provider = maptilerProvider('test-key');
const allTerrain = { hillshade: true, contours: true, terrain3d: true };

const data: MissionMapData = {
  polygons: [
    {
      id: 'a',
      letter: 'A',
      status: 'active',
      coverage: 82.4,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [35, 31.7],
            [35.01, 31.7],
            [35.01, 31.71],
            [35, 31.7],
          ],
        ],
      },
    },
  ],
  units: [{ id: 'u7', callsign: 7, state: 'sos', position: [35.005, 31.705] }],
  tracks: [
    {
      unitId: 'u7',
      positions: [
        [35.001, 31.701],
        [35.005, 31.705],
      ],
    },
  ],
  lkp: { id: 'lkp', position: [35.004, 31.703], time: '13:05' },
  lkpHistory: [{ id: 'old', position: [35.002, 31.702] }],
  sightings: [{ id: 's1', position: [35.006, 31.706], time: '15:40' }],
  rally: [34.999, 31.699],
  reports: [{ id: 'r1', position: [35.007, 31.707], hazard: true }],
};

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
    data,
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

describe('mission sources', () => {
  it('labels polygons and formats callsigns', () => {
    const sources = toMissionSources(data);
    expect(sources[SOURCE.polygons].features[0]?.properties?.label).toBe('A 82%');
    expect(sources[SOURCE.units].features[0]?.properties?.callsign).toBe('07');
    expect(sources[SOURCE.lkp].features[0]?.properties?.label).toBe('LKP 13:05');
  });

  it('renders icons at 2x', () => {
    const icon = mapIcons('night')[iconId('night', 'lkp')];
    expect(icon?.svg).toContain(`width="${30 * ICON_PIXEL_RATIO}"`);
  });
});

describe('maptiler provider', () => {
  it('limits place search to Israel and asks for Hebrew', () => {
    const url = maptilerProvider('k').geocodingUrl?.('נחל עמוד') ?? '';
    expect(url).toContain('language=he');
    expect(url).toContain('bbox=34.2,29.4,35.95,33.4');
    expect(url).toContain(encodeURIComponent('נחל עמוד'));
  });
});
