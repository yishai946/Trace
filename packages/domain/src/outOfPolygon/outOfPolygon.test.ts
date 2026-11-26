import { describe, expect, it } from 'vitest';
import { nextPolygonPresence } from '.';

describe('nextPolygonPresence', () => {
  it('reports a searcher who was inside and is now outside as having left', () => {
    expect(nextPolygonPresence({ outsideMeters: 12, toleranceMeters: 0, wasOutside: false })).toBe('left');
  });

  it('reports nothing for a searcher inside the polygon', () => {
    expect(nextPolygonPresence({ outsideMeters: 0, toleranceMeters: 0, wasOutside: false })).toBeNull();
  });

  it('reports nothing again while the searcher stays outside', () => {
    expect(nextPolygonPresence({ outsideMeters: 40, toleranceMeters: 0, wasOutside: true })).toBeNull();
  });

  it('reports a return once the searcher who was outside is back inside', () => {
    expect(nextPolygonPresence({ outsideMeters: 0, toleranceMeters: 0, wasOutside: true })).toBe('returned');
  });

  it('forgives a distance within the tolerance, and reports one past it', () => {
    expect(nextPolygonPresence({ outsideMeters: 10, toleranceMeters: 10, wasOutside: false })).toBeNull();
    expect(nextPolygonPresence({ outsideMeters: 10.5, toleranceMeters: 10, wasOutside: false })).toBe('left');
  });

  it('counts a searcher back within the tolerance as returned', () => {
    expect(nextPolygonPresence({ outsideMeters: 8, toleranceMeters: 10, wasOutside: true })).toBe('returned');
  });
});
