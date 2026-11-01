import { describe, expect, it } from 'vitest';
import type { LngLat } from '../types';
import { formatItm, formatLatLng, fromItm, toItm } from '.';
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
