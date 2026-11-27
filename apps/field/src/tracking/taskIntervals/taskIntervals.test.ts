import { beforeEach, describe, expect, it } from 'vitest';
import { recordTaskStatus, resetTaskIntervals, taskStatusAt } from '.';

describe('taskIntervals', () => {
  beforeEach(() => resetTaskIntervals());

  it('knows nothing before a status was recorded', () => {
    expect(taskStatusAt(1000)).toBeUndefined();
  });

  it('answers the status that held at a time, not the latest one', () => {
    recordTaskStatus('searching', 1000);
    recordTaskStatus('paused', 2000);
    recordTaskStatus('searching', 3000);
    expect(taskStatusAt(1500)).toBe('searching');
    expect(taskStatusAt(2500)).toBe('paused');
    expect(taskStatusAt(3500)).toBe('searching');
  });

  it('uses the boundary time for the new status', () => {
    recordTaskStatus('searching', 1000);
    recordTaskStatus('paused', 2000);
    expect(taskStatusAt(2000)).toBe('paused');
  });

  it('gives a time before the first record the first known status', () => {
    recordTaskStatus('paused', 2000);
    expect(taskStatusAt(500)).toBe('paused');
  });

  it('ignores a repeat of the same status and keeps a null (no task) as a status', () => {
    recordTaskStatus('searching', 1000);
    recordTaskStatus('searching', 2000);
    recordTaskStatus(null, 3000);
    expect(taskStatusAt(2500)).toBe('searching');
    expect(taskStatusAt(3500)).toBeNull();
  });

  it('forgets everything on reset', () => {
    recordTaskStatus('searching', 1000);
    resetTaskIntervals();
    expect(taskStatusAt(1500)).toBeUndefined();
  });
});
