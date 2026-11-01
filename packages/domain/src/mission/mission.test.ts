import { describe, expect, it } from 'vitest';
import { canChangePolygons, isMissionEnded } from '.';

describe('mission rules', () => {
  it('allows polygon changes only while the mission is active', () => {
    expect(canChangePolygons('active')).toBe(true);
    expect(canChangePolygons('paused')).toBe(false);
    expect(canChangePolygons('ended_located')).toBe(false);
    expect(canChangePolygons('ended_stopped')).toBe(false);
  });

  it('treats both end reasons as ended', () => {
    expect(isMissionEnded('ended_located')).toBe(true);
    expect(isMissionEnded('ended_stopped')).toBe(true);
    expect(isMissionEnded('paused')).toBe(false);
  });
});
