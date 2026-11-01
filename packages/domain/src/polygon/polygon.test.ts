import { describe, expect, it } from 'vitest';
import { nextPolygonName } from '.';

describe('nextPolygonName', () => {
  it('starts at פוליגון 1', () => {
    expect(nextPolygonName([])).toBe('פוליגון 1');
  });

  it('counts past the highest default name, ignoring names the commander chose', () => {
    expect(nextPolygonName(['פוליגון 1', 'ואדי צפוני', 'פוליגון 3'])).toBe('פוליגון 4');
    expect(nextPolygonName(['ואדי צפוני', 'חורשה'])).toBe('פוליגון 1');
  });
});
