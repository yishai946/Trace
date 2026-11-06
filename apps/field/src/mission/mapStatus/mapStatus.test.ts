import { describe, expect, it } from 'vitest';
import { mapStatus, type MapStatusInput } from '.';

const ready: MapStatusInput = {
  apiConfigured: true,
  signedIn: true,
  missionId: 'm1',
  isError: false,
  isFetching: false,
  hasData: true,
};

describe('mapStatus', () => {
  it('says nothing once the mission area is loaded', () => {
    expect(mapStatus(ready)).toBeNull();
  });

  it('says why the area cannot load yet, in the order the searcher fixes it', () => {
    expect(mapStatus({ ...ready, apiConfigured: false, signedIn: false, missionId: null })).toBe('no-api');
    expect(mapStatus({ ...ready, signedIn: false, missionId: null })).toBe('signed-out');
    expect(mapStatus({ ...ready, missionId: null })).toBe('no-mission');
  });

  it('shows loading on the first load', () => {
    expect(mapStatus({ ...ready, isFetching: true, hasData: false })).toBe('loading');
  });

  it('shows the error, and loading again while retrying', () => {
    expect(mapStatus({ ...ready, isError: true, hasData: false })).toBe('error');
    expect(mapStatus({ ...ready, isError: true, isFetching: true, hasData: false })).toBe('loading');
  });

  it('keeps showing the loaded area while it refreshes in the background', () => {
    expect(mapStatus({ ...ready, isFetching: true })).toBeNull();
  });
});
