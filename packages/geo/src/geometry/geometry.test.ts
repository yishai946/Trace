import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { areaSquareMeters, boundsOf, distanceOutsideMeters, findOutside, isInsidePolygon, isValidPolygon } from '.';

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

  it('rejects a boundary that crosses itself', () => {
    expect(isValidPolygon(square)).toBe(true);
    const bowtie: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [35.0, 31.7],
          [35.01, 31.71],
          [35.01, 31.7],
          [35.0, 31.71],
          [35.0, 31.7],
        ],
      ],
    };
    expect(isValidPolygon(bowtie)).toBe(false);
  });

  it('accepts a hole inside the outer ring and rejects one outside it', () => {
    const outer = square.coordinates[0] ?? [];
    const hole = [
      [35.002, 31.702],
      [35.004, 31.702],
      [35.004, 31.704],
      [35.002, 31.702],
    ];
    const outside = [
      [35.02, 31.72],
      [35.03, 31.72],
      [35.03, 31.73],
      [35.02, 31.72],
    ];
    expect(isValidPolygon({ type: 'Polygon', coordinates: [outer, hole] })).toBe(true);
    expect(isValidPolygon({ type: 'Polygon', coordinates: [outer, outside] })).toBe(false);
  });

  it('rejects a hole inside another hole', () => {
    const outer = square.coordinates[0] ?? [];
    const bigHole = [
      [35.001, 31.701],
      [35.009, 31.701],
      [35.009, 31.709],
      [35.001, 31.701],
    ];
    const smallHole = [
      [35.006, 31.703],
      [35.007, 31.703],
      [35.007, 31.704],
      [35.006, 31.703],
    ];
    expect(isValidPolygon({ type: 'Polygon', coordinates: [outer, bigHole, smallHole] })).toBe(false);
  });
});
