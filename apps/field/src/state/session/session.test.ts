import { beforeEach, describe, expect, it } from 'vitest';
import { useSession } from '.';
import { setItemAsync, secureStoreItems } from '../../test/secureStore';

describe('useSession', () => {
  beforeEach(() => useSession.setState(useSession.getInitialState()));

  it('starts signed out, outside any mission and not restored', () => {
    expect(useSession.getState()).toMatchObject({ token: null, missionId: null, restored: false });
  });

  it('restores the token saved on the device', async () => {
    secureStoreItems.set('trace.session-token', 't1');
    await useSession.getState().restore();
    expect(useSession.getState()).toMatchObject({ token: 't1', restored: true });
  });

  it('restores to signed out when nothing is saved', async () => {
    await useSession.getState().restore();
    expect(useSession.getState()).toMatchObject({ token: null, restored: true });
  });

  it('keeps the token in memory and on the device when signing in', async () => {
    await useSession.getState().signIn('t1');
    expect(useSession.getState()).toMatchObject({ token: 't1', restored: true });
    expect(secureStoreItems.get('trace.session-token')).toBe('t1');
  });

  it('keeps a new sign-in when the saved token is read afterwards', async () => {
    secureStoreItems.set('trace.session-token', 'old');
    await useSession.getState().signIn('new');
    await useSession.getState().restore();
    expect(useSession.getState().token).toBe('new');
  });

  it('forgets the token and the mission on the device and in memory when signing out', async () => {
    await useSession.getState().signIn('t1');
    useSession.getState().setMissionId('m1');

    await useSession.getState().signOut();
    expect(useSession.getState()).toMatchObject({ token: null, missionId: null });
    expect(secureStoreItems.has('trace.session-token')).toBe(false);
  });

  it('still signs in when the device refuses to store the token', async () => {
    setItemAsync.mockRejectedValueOnce(new Error('too large'));
    await useSession.getState().signIn('t1');
    expect(useSession.getState().token).toBe('t1');
  });
});
