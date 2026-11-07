import { beforeEach, describe, expect, it } from 'vitest';
import { useSession } from '.';

describe('useSession', () => {
  beforeEach(() => useSession.setState(useSession.getInitialState()));

  it('starts signed out and outside any mission', () => {
    expect(useSession.getState()).toMatchObject({ token: null, missionId: null });
  });

  it('keeps the token and the mission until cleared', () => {
    useSession.getState().setToken('t1');
    useSession.getState().setMissionId('m1');
    expect(useSession.getState()).toMatchObject({ token: 't1', missionId: 'm1' });

    useSession.getState().clear();
    expect(useSession.getState()).toMatchObject({ token: null, missionId: null });
  });
});
