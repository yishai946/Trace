import { describe, expect, it } from 'vitest';
import { canChangeLkp, canChangePolygons, canChangeRallyPoint, canEditMissionDetails, isMissionEnded } from '.';

describe('mission rules', () => {
  it('allows polygon changes only while the mission is active', () => {
    expect(canChangePolygons('active')).toBe(true);
    expect(canChangePolygons('paused')).toBe(false);
    expect(canChangePolygons('ended_located')).toBe(false);
    expect(canChangePolygons('ended_stopped')).toBe(false);
  });

  it('allows LKP changes until the mission ends', () => {
    expect(canChangeLkp('active')).toBe(true);
    expect(canChangeLkp('paused')).toBe(true);
    expect(canChangeLkp('ended_located')).toBe(false);
    expect(canChangeLkp('ended_stopped')).toBe(false);
  });

  it('allows a rally point change while the mission is active or paused', () => {
    expect(canChangeRallyPoint('active')).toBe(true);
    expect(canChangeRallyPoint('paused')).toBe(true);
    expect(canChangeRallyPoint('ended_located')).toBe(false);
    expect(canChangeRallyPoint('ended_stopped')).toBe(false);
  });

  it('allows editing the details while the mission is active or paused (UC-C03)', () => {
    expect(canEditMissionDetails('active')).toBe(true);
    expect(canEditMissionDetails('paused')).toBe(true);
    expect(canEditMissionDetails('ended_located')).toBe(false);
    expect(canEditMissionDetails('ended_stopped')).toBe(false);
  });

  it('treats both end reasons as ended', () => {
    expect(isMissionEnded('ended_located')).toBe(true);
    expect(isMissionEnded('ended_stopped')).toBe(true);
    expect(isMissionEnded('paused')).toBe(false);
  });
});
