import { describe, expect, it } from 'vitest';
import { isSearcherOffline, latestUpdateAt, OFFLINE_AFTER_MS } from '.';

const now = new Date('2026-11-23T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('isSearcherOffline', () => {
  it('is online while the live connection is open, whatever the last update', () => {
    expect(isSearcherOffline({ connected: true, lastUpdateAt: ago(OFFLINE_AFTER_MS * 10), now })).toBe(false);
    expect(isSearcherOffline({ connected: true, lastUpdateAt: null, now })).toBe(false);
  });

  it('is online without a connection when the last update is within the threshold', () => {
    expect(isSearcherOffline({ connected: false, lastUpdateAt: ago(OFFLINE_AFTER_MS), now })).toBe(false);
    expect(isSearcherOffline({ connected: false, lastUpdateAt: ago(1000), now })).toBe(false);
  });

  it('is offline without a connection once the last update is older than the threshold', () => {
    expect(isSearcherOffline({ connected: false, lastUpdateAt: ago(OFFLINE_AFTER_MS + 1), now })).toBe(true);
  });

  it('is offline without a connection and without any update', () => {
    expect(isSearcherOffline({ connected: false, lastUpdateAt: null, now })).toBe(true);
  });

  it('treats an update dated in the future as fresh', () => {
    expect(isSearcherOffline({ connected: false, lastUpdateAt: new Date(now.getTime() + 5000), now })).toBe(false);
  });
});

describe('latestUpdateAt', () => {
  it('returns the newest of the given times, ignoring missing ones', () => {
    const older = ago(5000);
    const newer = ago(1000);
    expect(latestUpdateAt([older, null, newer])).toEqual(newer);
  });

  it('returns null when there is none', () => {
    expect(latestUpdateAt([null, null])).toBeNull();
    expect(latestUpdateAt([])).toBeNull();
  });
});
