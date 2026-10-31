import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { areaSquareMeters, boundsOf, distanceOutsideMeters, findOutside, isInsidePolygon } from './geometry';
import { formatItm, formatLatLng, fromItm, toItm } from './itm';
import type { LngLat } from './types';

describe('ITM', () => {
  it('maps the grid origin close to its false easting/northing', () => {
    const itm = toItm([35.2045169444444, 31.7343936111111]);
    // The origin is defined on the Israel 1993 datum. The same lat/lng on WGS84 sits up to ~70 m away
    // (translation of ~35 m plus rotations of ~2 arc-seconds in the EPSG datum shift).
    expect(Math.abs(itm.easting - 219529.584)).toBeLessThan(100);
    expect(Math.abs(itm.northing - 626907.39)).toBeLessThan(100);
  });

  it('round-trips within a centimeter', () => {
    const point: LngLat = [35.0127, 31.7431];
    const [lng, lat] = fromItm(toItm(point));
    const back = toItm([lng, lat]);
    const original = toItm(point);
    expect(Math.abs(back.easting - original.easting)).toBeLessThan(0.01);
    expect(Math.abs(back.northing - original.northing)).toBeLessThan(0.01);
  });

  it('places Tel Aviv west and north of Jerusalem', () => {
    const telAviv = toItm([34.7818, 32.0853]);
    const jerusalem = toItm([35.2137, 31.7683]);
    expect(telAviv.easting).toBeLessThan(jerusalem.easting);
    expect(telAviv.northing).toBeGreaterThan(jerusalem.northing);
  });

  it('formats coordinates', () => {
    expect(formatItm({ easting: 219529.584, northing: 626907.39 })).toBe('219530 / 626907');
    expect(formatLatLng([35.01271, 31.74312])).toBe('31.7431, 35.0127');
  });
});

describe('geometry', () => {
  // About 1.1 km x 1.1 km near Jerusalem.
  const square: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [35.0, 31.7],
        [35.01, 31.7],
        [35.01, 31.71],
        [35.0, 31.71],
        [35.0, 31.7],
      ],
    ],
  };

  it('detects points inside and outside', () => {
    expect(isInsidePolygon([35.005, 31.705], square)).toBe(true);
    expect(isInsidePolygon([35.02, 31.705], square)).toBe(false);
  });

  it('measures distance outside the boundary and 0 inside', () => {
    expect(distanceOutsideMeters([35.005, 31.705], square)).toBe(0);
    // 0.001 degrees of longitude at latitude 31.7 is about 95 m.
    expect(distanceOutsideMeters([35.011, 31.705], square)).toBeGreaterThan(80);
    expect(distanceOutsideMeters([35.011, 31.705], square)).toBeLessThan(110);
  });

  it('finds items left outside a polygon', () => {
    const outside = findOutside(
      [
        { id: 3, position: [35.011, 31.705] },
        { id: 4, position: [35.005, 31.705] },
      ],
      square,
    );
    expect(outside.map((o) => o.id)).toEqual([3]);
  });

  it('computes area and bounds', () => {
    const area = areaSquareMeters(square);
    expect(area).toBeGreaterThan(1_000_000);
    expect(area).toBeLessThan(1_200_000);
    expect(boundsOf(square)).toEqual([35.0, 31.7, 35.01, 31.71]);
  });
});
