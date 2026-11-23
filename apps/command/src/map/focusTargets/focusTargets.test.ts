import { emptyMissionMapData, type MapPolygon, type MissionMapData } from '@trace/map';
import { describe, expect, it } from 'vitest';
import { pointFocus, polygonFocus, searchAreaFocus } from '.';

const square = (id: string, west: number, south: number, size: number): MapPolygon => ({
  id,
  name: id,
  status: 'active',
  coverage: null,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [west + size, south],
        [west + size, south + size],
        [west, south + size],
        [west, south],
      ],
    ],
  },
});

const data = (extra: Partial<MissionMapData>): MissionMapData => ({ ...emptyMissionMapData, ...extra });

describe('searchAreaFocus', () => {
  const polygons = [square('a', 35, 31, 0.1), square('b', 35.2, 31.2, 0.1)];

  it('goes to the LKP first', () => {
    const focus = searchAreaFocus(data({ lkp: { id: 'lkp', position: [35.5, 31.5] }, rally: [35.6, 31.6], polygons }));
    expect(focus).toEqual({ center: [35.5, 31.5] });
  });

  it('goes to the rally point when there is no LKP', () => {
    expect(searchAreaFocus(data({ rally: [35.6, 31.6], polygons }))).toEqual({ center: [35.6, 31.6] });
  });

  it('fits all polygons when there is neither', () => {
    const focus = searchAreaFocus(data({ polygons }));
    const [west, south, east, north] = focus?.bounds ?? [];
    expect([west, south]).toEqual([35, 31]);
    expect(east).toBeCloseTo(35.3);
    expect(north).toBeCloseTo(31.3);
    expect(focus?.center[0]).toBeCloseTo(35.15);
    expect(focus?.center[1]).toBeCloseTo(31.15);
  });

  it('is null when the mission has nothing to go to', () => {
    expect(searchAreaFocus(data({}))).toBeNull();
  });
});

describe('polygonFocus', () => {
  it('fits the whole polygon, not a point inside it', () => {
    const focus = polygonFocus(data({ polygons: [square('a', 35, 31, 0.1)] }), 'a');
    expect(focus?.bounds).toEqual([35, 31, 35.1, 31.1]);
  });

  it('is null for a polygon that is gone', () => {
    expect(polygonFocus(data({ polygons: [] }), 'a')).toBeNull();
  });
});

describe('pointFocus', () => {
  const full = data({
    lkp: { id: 'lkp-2', position: [35.1, 31.1] },
    lkpHistory: [{ id: 'lkp-1', position: [35.0, 31.0] }],
    sightings: [{ id: 's1', position: [35.2, 31.2], label: '1' }],
    reports: [{ id: 'r1', position: [35.3, 31.3], hazard: false }],
  });

  it('centers on the clicked symbol', () => {
    expect(pointFocus(full, { kind: 'sighting', id: 's1' })).toEqual({ center: [35.2, 31.2] });
    expect(pointFocus(full, { kind: 'report', id: 'r1' })).toEqual({ center: [35.3, 31.3] });
    expect(pointFocus(full, { kind: 'lkp', id: 'lkp-2' })).toEqual({ center: [35.1, 31.1] });
    expect(pointFocus(full, { kind: 'lkp', id: 'lkp-1' })).toEqual({ center: [35.0, 31.0] });
  });

  it('treats the id `lkp` as the current LKP', () => {
    expect(pointFocus(full, { kind: 'lkp', id: 'lkp' })).toEqual({ center: [35.1, 31.1] });
  });

  it('is null when the symbol is gone', () => {
    expect(pointFocus(full, { kind: 'sighting', id: 'zzz' })).toBeNull();
  });
});
