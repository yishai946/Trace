import { describe, expect, it } from 'vitest';
import { searchFinishRefusal, type SearchFinishState } from '.';

const searching: SearchFinishState = {
  missionStatus: 'active',
  participationStatus: 'assigned',
  taskStatus: 'searching',
};

describe('searchFinishRefusal (UC-F08)', () => {
  it('accepts Finish from Searching and from Paused', () => {
    expect(searchFinishRefusal(searching)).toBeNull();
    expect(searchFinishRefusal({ ...searching, taskStatus: 'paused' })).toBeNull();
  });

  it('refuses a task that is not in the search', () => {
    expect(searchFinishRefusal({ ...searching, taskStatus: 'ready' })).toBe('task_not_active');
    expect(searchFinishRefusal({ ...searching, taskStatus: 'finished' })).toBe('task_not_active');
  });

  it('needs an active mission and an assigned searcher', () => {
    expect(searchFinishRefusal({ ...searching, missionStatus: 'paused' })).toBe('mission_not_active');
    expect(searchFinishRefusal({ ...searching, missionStatus: 'ended_located' })).toBe('mission_ended');
    expect(searchFinishRefusal({ ...searching, participationStatus: 'ended' })).toBe('participation_ended');
    expect(searchFinishRefusal({ ...searching, participationStatus: 'available', taskStatus: null })).toBe(
      'not_assigned',
    );
  });
});
