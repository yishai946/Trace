import { describe, expect, it } from 'vitest';
import { isActiveInPolygon } from '.';

describe('isActiveInPolygon', () => {
  it('counts searchers assigned to the polygon', () => {
    expect(isActiveInPolygon({ status: 'assigned', polygonId: 'p1' }, 'p1')).toBe(true);
  });

  it('ignores other polygons, available searchers and ended participation', () => {
    expect(isActiveInPolygon({ status: 'assigned', polygonId: 'p2' }, 'p1')).toBe(false);
    expect(isActiveInPolygon({ status: 'available', polygonId: null }, 'p1')).toBe(false);
    expect(isActiveInPolygon({ status: 'ended', polygonId: 'p1' }, 'p1')).toBe(false);
  });
});
