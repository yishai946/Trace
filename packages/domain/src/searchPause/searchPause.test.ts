import { describe, expect, it } from 'vitest';
import { searchPauseRefusal, searchPauseTarget, type SearchPauseState } from '.';

const searching: SearchPauseState = {
  missionStatus: 'active',
  participationStatus: 'assigned',
  taskStatus: 'searching',
};
const paused: SearchPauseState = { ...searching, taskStatus: 'paused' };

describe('searchPauseTarget', () => {
  it('swaps Searching and Paused', () => {
    expect(searchPauseTarget('pause')).toBe('paused');
    expect(searchPauseTarget('resume')).toBe('searching');
  });
});

describe('searchPauseRefusal (UC-F07)', () => {
  it('accepts Pause while searching and Resume while paused', () => {
    expect(searchPauseRefusal('pause', searching)).toBeNull();
    expect(searchPauseRefusal('resume', paused)).toBeNull();
  });

  it('refuses Pause outside Searching and Resume outside Paused', () => {
    for (const taskStatus of ['ready', 'paused', 'finished'] as const) {
      expect(searchPauseRefusal('pause', { ...searching, taskStatus })).toBe('task_not_searching');
    }
    for (const taskStatus of ['ready', 'searching', 'finished'] as const) {
      expect(searchPauseRefusal('resume', { ...paused, taskStatus })).toBe('task_not_paused');
    }
  });

  it('lets a paused mission outrank a personal Pause: no Resume while the mission is paused', () => {
    expect(searchPauseRefusal('resume', { ...paused, missionStatus: 'paused' })).toBe('mission_not_active');
    expect(searchPauseRefusal('pause', { ...searching, missionStatus: 'paused' })).toBe('mission_not_active');
  });

  it('refuses everything once the mission or the activity ended', () => {
    expect(searchPauseRefusal('resume', { ...paused, missionStatus: 'ended_located' })).toBe('mission_ended');
    expect(searchPauseRefusal('pause', { ...searching, missionStatus: 'ended_stopped' })).toBe('mission_ended');
    expect(searchPauseRefusal('pause', { ...searching, participationStatus: 'ended', taskStatus: null })).toBe(
      'participation_ended',
    );
  });

  it('refuses a searcher with no assignment', () => {
    expect(searchPauseRefusal('pause', { ...searching, participationStatus: 'available', taskStatus: null })).toBe(
      'not_assigned',
    );
  });
});
