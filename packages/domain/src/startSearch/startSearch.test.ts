import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS, missingPermissions, startSearchBlockers } from '.';

const allGranted = { location: true, backgroundLocation: true, push: true };
const allSaved = { missionInfo: true, map: true };

describe('missingPermissions', () => {
  it('lists the required permissions that are not granted, in order', () => {
    expect(missingPermissions({ location: true })).toEqual(['backgroundLocation', 'push']);
    expect(REQUIRED_PERMISSIONS).toEqual(['location', 'backgroundLocation', 'push']);
  });

  it('treats a permission that is not exactly granted (false or absent) as missing', () => {
    expect(missingPermissions({ ...allGranted, push: false })).toEqual(['push']);
    expect(missingPermissions(allGranted)).toEqual([]);
  });
});

describe('startSearchBlockers', () => {
  it('is ready only with the whole package saved and every required permission granted', () => {
    expect(startSearchBlockers(allSaved, allGranted)).toEqual({
      ready: true,
      missingParts: [],
      missingPermissions: [],
    });
  });

  it('blocks on a missing permission even when the package is saved (UC-F06, decision 73)', () => {
    expect(startSearchBlockers(allSaved, { location: true })).toEqual({
      ready: false,
      missingParts: [],
      missingPermissions: ['backgroundLocation', 'push'],
    });
  });

  it('blocks on an unfinished download even when every permission is granted', () => {
    expect(startSearchBlockers({ missionInfo: true }, allGranted)).toEqual({
      ready: false,
      missingParts: ['map'],
      missingPermissions: [],
    });
  });

  it('lists both kinds of blocker together', () => {
    expect(startSearchBlockers({}, {})).toEqual({
      ready: false,
      missingParts: ['missionInfo', 'map'],
      missingPermissions: ['location', 'backgroundLocation', 'push'],
    });
  });
});
