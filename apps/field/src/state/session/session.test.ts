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

  it('notes an assignment, then a move, and not a change of task in the same polygon', () => {
    const available = { id: 'p1', callsign: 7, status: 'available' as const, polygonId: null, taskStatus: null };
    useSession.getState().enterMission('m1', available);
    useSession
      .getState()
      .updateParticipation({ ...available, status: 'assigned', polygonId: 'a', taskStatus: 'ready' });
    expect(useSession.getState().assignmentNotice).toEqual({ kind: 'assigned', polygonId: 'a' });

    useSession
      .getState()
      .updateParticipation({ ...available, status: 'assigned', polygonId: 'b', taskStatus: 'ready' });
    expect(useSession.getState().assignmentNotice).toEqual({ kind: 'moved', polygonId: 'b' });

    useSession.getState().dismissAssignmentNotice();
    useSession
      .getState()
      .updateParticipation({ ...available, status: 'assigned', polygonId: 'b', taskStatus: 'searching' });
    expect(useSession.getState().assignmentNotice).toBeNull();
  });

  it('tracks from the first Start Search until the activity ends, also after a move', () => {
    const assigned = {
      id: 'p1',
      callsign: 7,
      status: 'assigned' as const,
      polygonId: 'a',
      taskStatus: 'ready' as const,
    };
    useSession.getState().enterMission('m1', assigned);
    useSession.getState().updateParticipation(assigned);
    expect(useSession.getState().tracking).toBe(false);

    useSession.getState().updateParticipation({ ...assigned, taskStatus: 'searching' });
    useSession.getState().updateParticipation({ ...assigned, polygonId: 'b', taskStatus: 'ready' });
    expect(useSession.getState().tracking).toBe(true);

    useSession.getState().updateParticipation({ ...assigned, status: 'ended', taskStatus: null });
    expect(useSession.getState().tracking).toBe(false);
  });

  it('tracks a paused searcher who joins again, since the search already started', () => {
    useSession
      .getState()
      .enterMission('m1', { id: 'p1', callsign: 7, status: 'assigned', polygonId: 'a', taskStatus: 'paused' });
    expect(useSession.getState().tracking).toBe(true);
  });

  it('enters the joined mission with the participation and drops the join link code', () => {
    const participation = { id: 'p1', callsign: 7, status: 'available' as const, polygonId: null, taskStatus: null };
    useSession.getState().setPendingJoinCode('K7-4Q2');
    useSession.getState().enterMission('m1', participation);

    expect(useSession.getState()).toMatchObject({ missionId: 'm1', participation, pendingJoinCode: null });
  });
});
