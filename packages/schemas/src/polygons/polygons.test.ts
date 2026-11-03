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

  it('gives a blank name on create to the server default, and refuses a blank rename', () => {
    expect(CreatePolygonBody.parse({ geometry, name: '  ' }).name).toBeUndefined();
    expect(UpdatePolygonBody.safeParse({ name: '  ' }).success).toBe(false);
    expect(UpdatePolygonBody.parse({ name: ' ואדי ' }).name).toBe('ואדי');
  });

  it('requires geometry or name in an update', () => {
    expect(UpdatePolygonBody.safeParse({}).success).toBe(false);
    expect(UpdatePolygonBody.safeParse({ confirmSearchersOutside: true }).success).toBe(false);
    expect(UpdatePolygonBody.parse({ geometry }).confirmSearchersOutside).toBe(false);
  });
});
