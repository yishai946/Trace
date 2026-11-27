import { describe, expect, it } from 'vitest';
import { nextPolygonName, polygonStatusChange } from '.';

describe('nextPolygonName', () => {
  it('starts at פוליגון 1', () => {
    expect(nextPolygonName([])).toBe('פוליגון 1');
  });

  it('counts past the highest default name, ignoring names the commander chose', () => {
    expect(nextPolygonName(['פוליגון 1', 'ואדי צפוני', 'פוליגון 3'])).toBe('פוליגון 4');
    expect(nextPolygonName(['ואדי צפוני', 'חורשה'])).toBe('פוליגון 1');
  });
});

describe('polygonStatusChange', () => {
  it('lets a polygon be Completed from any other status, at any Coverage', () => {
    expect(polygonStatusChange('unassigned', 'completed')).toBe('allowed');
    expect(polygonStatusChange('active', 'completed')).toBe('allowed');
  });

  it('lets a Completed polygon return to Active', () => {
    expect(polygonStatusChange('completed', 'active')).toBe('allowed');
  });

  it('refuses Active for a polygon that was never Completed', () => {
    expect(polygonStatusChange('unassigned', 'active')).toBe('refused');
  });

  it('does nothing when the polygon is already there', () => {
    expect(polygonStatusChange('completed', 'completed')).toBe('unchanged');
    expect(polygonStatusChange('active', 'active')).toBe('unchanged');
  });
});
