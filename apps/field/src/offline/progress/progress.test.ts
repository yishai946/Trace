import { canStartSearch } from '@trace/domain';
import { describe, expect, it } from 'vitest';
import { offlineProgress, savedParts } from './index';

describe('offlineProgress', () => {
  it('is 0% with nothing saved and 100% with every step saved', () => {
    expect(offlineProgress([])).toEqual({ done: 0, total: 3, percent: 0, complete: false });
    expect(offlineProgress(['mission', 'photo', 'polygons'])).toEqual({
      done: 3,
      total: 3,
      percent: 100,
      complete: true,
    });
  });

  it('rounds the share of saved steps', () => {
    expect(offlineProgress(['mission'])).toMatchObject({ done: 1, percent: 33, complete: false });
    expect(offlineProgress(['mission', 'photo'])).toMatchObject({ done: 2, percent: 67 });
  });
});

describe('savedParts', () => {
  it('saves the mission info with the details and the photo, and the map with the details and the polygons', () => {
    expect(savedParts(['mission', 'photo'])).toEqual({ missionInfo: true, map: false });
    expect(savedParts(['mission', 'polygons'])).toEqual({ missionInfo: false, map: true });
    expect(savedParts(['photo', 'polygons'])).toEqual({ missionInfo: false, map: false });
  });

  it('lets Start Search through only when every part is saved', () => {
    expect(canStartSearch(savedParts(['mission', 'photo'])).ready).toBe(false);
    expect(canStartSearch(savedParts(['mission', 'photo', 'polygons'])).ready).toBe(true);
  });
});
