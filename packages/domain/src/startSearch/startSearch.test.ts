import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS, missingPermissions, startSearchBlockers, startSearchRefusal } from '.';

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

describe('startSearchRefusal (UC-F06)', () => {
  const ok = { missionStatus: 'active', participationStatus: 'assigned', taskStatus: 'ready' } as const;

  it('allows an assigned searcher at Ready in an active mission', () => {
    expect(startSearchRefusal(ok)).toBeNull();
  });

  it('refuses in a paused or an ended mission', () => {
    expect(startSearchRefusal({ ...ok, missionStatus: 'paused' })).toBe('mission_not_active');
    expect(startSearchRefusal({ ...ok, missionStatus: 'ended_located' })).toBe('mission_ended');
    expect(startSearchRefusal({ ...ok, missionStatus: 'ended_stopped' })).toBe('mission_ended');
  });

  it('refuses a searcher whose activity ended, or who has no assignment', () => {
    expect(startSearchRefusal({ ...ok, participationStatus: 'ended', taskStatus: null })).toBe('participation_ended');
    expect(startSearchRefusal({ ...ok, participationStatus: 'available', taskStatus: null })).toBe('not_assigned');
  });

  it('refuses a task that is not at Ready (resuming is UC-F07)', () => {
    expect(startSearchRefusal({ ...ok, taskStatus: 'searching' })).toBe('task_not_ready');
    expect(startSearchRefusal({ ...ok, taskStatus: 'paused' })).toBe('task_not_ready');
    expect(startSearchRefusal({ ...ok, taskStatus: 'finished' })).toBe('task_not_ready');
  });
});
