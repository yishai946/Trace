import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './index';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aborts after the time limit and says it timed out', () => {
    const limit = withTimeout(undefined, 1000);
    vi.advanceTimersByTime(999);
    expect(limit.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(limit.signal.aborted).toBe(true);
    expect(limit.timedOut()).toBe(true);
  });

  it('aborts with the caller, without counting as a timeout', () => {
    const caller = new AbortController();
    const limit = withTimeout(caller.signal, 1000);
    caller.abort();
    expect(limit.signal.aborted).toBe(true);
    expect(limit.timedOut()).toBe(false);
  });

  it('is aborted from the start when the caller already aborted', () => {
    const caller = new AbortController();
    caller.abort();
    expect(withTimeout(caller.signal, 1000).signal.aborted).toBe(true);
  });

  it('stops the timer on dispose', () => {
    const limit = withTimeout(undefined, 1000);
    limit.dispose();
    vi.advanceTimersByTime(5000);
    expect(limit.signal.aborted).toBe(false);
  });
});
