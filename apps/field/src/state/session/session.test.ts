import { saveStep, savedSteps } from '../../offline/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSession } from '.';
import { enqueue, pendingCount } from '../../outbox';
import { setItemAsync, secureStoreItems } from '../../test/secureStore';
import { loadSavedMission, saveMission } from '../savedMission';

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

  it('empties the outbox at sign-out, so the next person on the phone sends nothing of theirs', async () => {
    await enqueue({ kind: 'track-point', missionId: 'm1', payloads: [1, 2] });
    await useSession.getState().signOut();
    expect(await pendingCount()).toBe(0);
  });

  it('drops the offline packages at sign-out, so the next person on the phone cannot read the missing person', async () => {
    await saveStep('m1', 'mission', { json: {} });
    await useSession.getState().signOut();
    expect(await savedSteps('m1')).toEqual([]);
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

  it('notes when the commander ended the participation, and stops tracking', () => {
    const searching = {
      id: 'p1',
      callsign: 7,
      status: 'assigned' as const,
      polygonId: 'a',
      taskStatus: 'searching' as const,
    };
    useSession.getState().enterMission('m1', searching);
    useSession.getState().updateParticipation({ ...searching, status: 'ended', polygonId: null, taskStatus: null });
    expect(useSession.getState()).toMatchObject({ tracking: false, assignmentNotice: { kind: 'ended' } });
  });

  it('clears the out-of-polygon warning when the searcher stops Searching or moves to another polygon (UC-S04)', () => {
    const searching = {
      id: 'p1',
      callsign: 7,
      status: 'assigned' as const,
      polygonId: 'a',
      taskStatus: 'searching' as const,
    };
    useSession.getState().enterMission('m1', searching);
    useSession.getState().setOutsidePolygon(true);
    useSession.getState().updateParticipation(searching);
    expect(useSession.getState().outsidePolygon).toBe(true);
    useSession.getState().updateParticipation({ ...searching, taskStatus: 'paused' });
    expect(useSession.getState().outsidePolygon).toBe(false);
    useSession.getState().setOutsidePolygon(true);
    useSession.getState().updateParticipation({ ...searching, polygonId: 'b' });
    expect(useSession.getState().outsidePolygon).toBe(false);
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
  describe('restoring the mission after a restart (UC-F16)', () => {
    const searching = {
      id: 'p1',
      callsign: 7,
      status: 'assigned' as const,
      polygonId: 'a',
      taskStatus: 'searching' as const,
    };
    const validId = { ...searching, id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11', polygonId: null, taskStatus: null };

    it('saves the mission when the searcher joins and when the server changes the participation', async () => {
      const participation = { ...validId, status: 'available' as const };
      useSession.getState().enterMission('m1', participation);
      useSession.getState().updateParticipation({ ...participation, status: 'assigned', polygonId: validId.id });
      expect(await loadSavedMission()).toMatchObject({ missionId: 'm1', participation: { status: 'assigned' } });
    });

    it('restores the mission, the participation and tracking of a searcher who was searching', async () => {
      const participation = {
        ...validId,
        status: 'assigned' as const,
        polygonId: validId.id,
        taskStatus: 'searching' as const,
      };
      await saveMission('m1', participation);
      secureStoreItems.set('trace.session-token', 't1');
      await useSession.getState().restore();
      expect(useSession.getState()).toMatchObject({ token: 't1', missionId: 'm1', participation, tracking: true });
    });

    it('does not track a restored searcher who has not started the search', async () => {
      await saveMission('m1', { ...validId, status: 'available' });
      secureStoreItems.set('trace.session-token', 't1');
      await useSession.getState().restore();
      expect(useSession.getState()).toMatchObject({ missionId: 'm1', tracking: false });
    });

    it('does not restore a mission without a saved sign-in, and forgets it', async () => {
      await saveMission('m1', validId);
      await useSession.getState().restore();
      expect(useSession.getState()).toMatchObject({ token: null, missionId: null, participation: null });
      expect(await loadSavedMission()).toBeNull();
    });

    it('keeps the mission a join made meanwhile over the saved one', async () => {
      await saveMission('m1', validId);
      secureStoreItems.set('trace.session-token', 't1');
      const restoring = useSession.getState().restore();
      useSession.getState().enterMission('m2', validId);
      await restoring;
      expect(useSession.getState().missionId).toBe('m2');
    });

    it('forgets the saved mission when the searcher leaves it or signs out', async () => {
      useSession.getState().enterMission('m1', validId);
      useSession.getState().setMissionId(null);
      expect(await loadSavedMission()).toBeNull();
      useSession.getState().enterMission('m1', validId);
      await useSession.getState().signOut();
      expect(await loadSavedMission()).toBeNull();
    });

    it('does not suppose a participation for a mission without one', () => {
      useSession.getState().setMissionId('m3');
      expect(useSession.getState()).toMatchObject({ missionId: 'm3', participation: null });
    });
  });
});
