import { describe, expect, it } from 'vitest';
import { OFFLINE_PACKAGE_PARTS, canStartSearch, missingOfflineParts } from '.';

const allSaved = Object.fromEntries(OFFLINE_PACKAGE_PARTS.map((part) => [part, true]));

describe('canStartSearch', () => {
  it('is not ready while nothing was saved', () => {
    expect(canStartSearch({})).toEqual({ ready: false, missing: [...OFFLINE_PACKAGE_PARTS] });
  });

  it('is not ready while the download was cut off before every part was saved', () => {
    const result = canStartSearch({ missionInfo: true });
    expect(result.ready).toBe(false);
    expect(result).toEqual({ ready: false, missing: ['map'] });
  });

  it('treats a part that was not saved completely (false) as missing', () => {
    expect(canStartSearch({ missionInfo: true, map: false })).toEqual({ ready: false, missing: ['map'] });
  });

  it('is ready once every essential part is saved', () => {
    expect(canStartSearch(allSaved)).toEqual({ ready: true, missing: [] });
  });
});

describe('missingOfflineParts', () => {
  it('lists the parts still to download, in package order', () => {
    expect(missingOfflineParts({ map: true })).toEqual(['missionInfo']);
  });
});
