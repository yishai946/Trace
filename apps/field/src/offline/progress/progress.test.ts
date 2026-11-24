import { canStartSearch } from '@trace/domain';
import { describe, expect, it } from 'vitest';
import { offlineProgress, savedParts } from './index';

describe('offlineProgress', () => {
  it('is 0% with nothing saved and 100% with every step saved', () => {
    expect(offlineProgress([])).toEqual({ done: 0, total: 4, percent: 0, complete: false });
    expect(offlineProgress(['mission', 'photo', 'polygons', 'map'])).toEqual({
      done: 4,
      total: 4,
      percent: 100,
      complete: true,
    });
  });

  it('rounds the share of saved steps', () => {
    expect(offlineProgress(['mission'])).toMatchObject({ done: 1, percent: 25, complete: false });
    expect(offlineProgress(['mission', 'photo', 'polygons'])).toMatchObject({ done: 3, percent: 75, complete: false });
  });
});

describe('savedParts', () => {
  it('saves the mission info with the details and the photo, and the map with the details, the polygons and the base map', () => {
    expect(savedParts(['mission', 'photo'])).toEqual({ missionInfo: true, map: false });
    expect(savedParts(['mission', 'polygons'])).toEqual({ missionInfo: false, map: false });
    expect(savedParts(['mission', 'polygons', 'map'])).toEqual({ missionInfo: false, map: true });
    expect(savedParts(['photo', 'polygons', 'map'])).toEqual({ missionInfo: false, map: false });
  });

  it('lets Start Search through only when every part is saved', () => {
    expect(canStartSearch(savedParts(['mission', 'photo'])).ready).toBe(false);
    expect(canStartSearch(savedParts(['mission', 'photo', 'polygons', 'map'])).ready).toBe(true);
  });
});
