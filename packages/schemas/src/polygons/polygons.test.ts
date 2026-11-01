import { describe, expect, it } from 'vitest';
import { CreatePolygonBody, UpdatePolygonBody } from '.';

const geometry = {
  type: 'Polygon',
  coordinates: [
    [
      [35.12, 31.77],
      [35.13, 31.77],
      [35.13, 31.78],
      [35.12, 31.77],
    ],
  ],
} as const;

describe('polygon bodies', () => {
  it('creates a polygon from geometry alone', () => {
    expect(CreatePolygonBody.parse({ geometry })).toEqual({ geometry });
  });

  it('turns a blank name into null', () => {
    expect(UpdatePolygonBody.parse({ name: '  ' }).name).toBeNull();
  });

  it('requires geometry or name in an update', () => {
    expect(UpdatePolygonBody.safeParse({}).success).toBe(false);
    expect(UpdatePolygonBody.safeParse({ confirmSearchersOutside: true }).success).toBe(false);
    expect(UpdatePolygonBody.parse({ geometry }).confirmSearchersOutside).toBe(false);
  });
});
