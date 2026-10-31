import { describe, expect, it } from 'vitest';
import { LngLat, PolygonGeometry } from './geo';

describe('geo schemas', () => {
  it('rejects positions outside WGS84 ranges', () => {
    expect(LngLat.safeParse([35.2, 31.7]).success).toBe(true);
    expect(LngLat.safeParse([200, 31.7]).success).toBe(false);
  });

  it('accepts a closed polygon and rejects an open one', () => {
    const closed = [
      [35, 31.7],
      [35.01, 31.7],
      [35.01, 31.71],
      [35, 31.7],
    ];
    expect(PolygonGeometry.safeParse({ type: 'Polygon', coordinates: [closed] }).success).toBe(true);
    expect(PolygonGeometry.safeParse({ type: 'Polygon', coordinates: [closed.slice(0, 3)] }).success).toBe(false);
    const open = [...closed.slice(0, 3), [35, 31.705]];
    expect(PolygonGeometry.safeParse({ type: 'Polygon', coordinates: [open] }).success).toBe(false);
  });
});
