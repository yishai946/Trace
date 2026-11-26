import { describe, expect, it } from 'vitest';
import { coveragePercent, type CoverageRoute } from '.';
import type { LngLat, Polygon } from '../types';

const ORIGIN: LngLat = [35, 32];
const METERS_PER_DEGREE = 111_320;

/** A position `east` / `north` meters from the origin. */
function at(east: number, north: number): LngLat {
  return [
    ORIGIN[0] + east / (METERS_PER_DEGREE * Math.cos((ORIGIN[1] * Math.PI) / 180)),
    ORIGIN[1] + north / METERS_PER_DEGREE,
  ];
}

/** A square of `size` meters with its south-west corner at the origin. */
function square(size: number): Polygon {
  return { type: 'Polygon', coordinates: [[at(0, 0), at(size, 0), at(size, size), at(0, size), at(0, 0)]] };
}

const START = Date.UTC(2026, 0, 1);

/** A searcher walking north along `east`, one point every `seconds`, `step` meters apart, from `from` to `to`. */
function walk(
  east: number,
  { from = -10, to = 110, step = 10, seconds = 5, context = 'search' as 'search' | 'safety', accuracy = 5 } = {},
): CoverageRoute {
  const points = [];
  for (let n = from, i = 0; n <= to; n += step, i += 1) {
    points.push({ position: at(east, n), recordedAt: START + i * seconds * 1000, accuracy, context });
  }
  return { points };
}

describe('coveragePercent', () => {
  const polygon = square(100);

  it('is 0 without routes or points', () => {
    expect(coveragePercent(polygon, [])).toBe(0);
    expect(coveragePercent(polygon, [{ points: [] }])).toBe(0);
  });

  it('counts the 20 m wide strip of a walk through the polygon (10 m to each side)', () => {
    const percent = coveragePercent(polygon, [walk(50)]);
    expect(percent).toBeGreaterThanOrEqual(19);
    expect(percent).toBeLessThanOrEqual(20);
  });

  it('is 0 for a route outside the polygon', () => {
    expect(coveragePercent(polygon, [walk(500)])).toBe(0);
  });

  it('does not count points recorded outside Searching (Pause, no GPS)', () => {
    expect(coveragePercent(polygon, [walk(50, { context: 'safety' })])).toBe(0);
  });

  it('does not count a segment between a Searching point and a safety point', () => {
    const route = walk(50);
    const [first, second] = route.points;
    if (!first || !second) throw new Error('route too short');
    expect(coveragePercent(polygon, [{ points: [first, { ...second, context: 'safety' }] }])).toBe(0);
  });

  it('does not double count two searchers on the same route', () => {
    expect(coveragePercent(polygon, [walk(50), walk(50)])).toBe(coveragePercent(polygon, [walk(50)]));
  });

  it('unites the routes of several searchers', () => {
    const one = coveragePercent(polygon, [walk(20)]);
    const both = coveragePercent(polygon, [walk(20), walk(70)]);
    expect(both).toBeGreaterThanOrEqual(2 * one - 1);
    expect(both).toBeLessThanOrEqual(2 * one + 1);
  });

  it('does not count a segment after a gap of more than 60 seconds', () => {
    expect(coveragePercent(polygon, [walk(50, { seconds: 61, step: 10 })])).toBe(0);
    expect(coveragePercent(polygon, [walk(50, { seconds: 60, step: 10 })])).toBeGreaterThan(0);
  });

  it('does not count a segment faster than 4 m/s (a GPS jump)', () => {
    expect(coveragePercent(polygon, [walk(50, { step: 25, seconds: 5 })])).toBe(0);
  });

  it('rejects points with accuracy worse than 30 m', () => {
    expect(coveragePercent(polygon, [walk(50, { accuracy: 31 })])).toBe(0);
    expect(coveragePercent(polygon, [walk(50, { accuracy: 30 })])).toBeGreaterThan(0);
  });

  it('keeps counting points that report no accuracy', () => {
    expect(coveragePercent(polygon, [walk(50, { accuracy: undefined })])).toBeGreaterThan(0);
  });

  it('does not bridge a rejected point', () => {
    const route = walk(50, { from: 0, to: 20 });
    const [a, b, c] = route.points;
    if (!a || !b || !c) throw new Error('route too short');
    expect(coveragePercent(polygon, [{ points: [a, { ...b, accuracy: 80 }, c] }])).toBe(0);
  });

  it('orders points by recording time before building segments', () => {
    const route = walk(50);
    expect(coveragePercent(polygon, [{ points: [...route.points].reverse() }])).toBe(coveragePercent(polygon, [route]));
  });

  it('caps at 100 and rounds down to a whole percent', () => {
    const lanes = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((east) => walk(east));
    expect(coveragePercent(polygon, lanes)).toBeGreaterThanOrEqual(99);
    expect(coveragePercent(polygon, lanes)).toBeLessThanOrEqual(100);
    expect(Number.isInteger(coveragePercent(polygon, [walk(50)]))).toBe(true);
  });

  it('cuts the strip at the polygon boundary and ignores holes', () => {
    const withHole: Polygon = {
      type: 'Polygon',
      coordinates: [...square(100).coordinates, [at(40, 40), at(40, 60), at(60, 60), at(60, 40), at(40, 40)]],
    };
    expect(coveragePercent(withHole, [walk(50)])).toBeLessThan(coveragePercent(polygon, [walk(50)]));
  });
});
