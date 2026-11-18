import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOS_HOLD_MS, useHoldToActivate } from '.';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useHoldToActivate', () => {
  it('completes after the whole hold and counts the seconds left', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useHoldToActivate({ onComplete }));
    expect(result.current.secondsLeft).toBeNull();
    act(() => result.current.start());
    expect(result.current.secondsLeft).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(2);
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS - 1001));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.secondsLeft).toBeNull();
  });

  it('does nothing when the finger is lifted early', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useHoldToActivate({ onComplete }));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS - 1));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS));
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.secondsLeft).toBeNull();
  });

  it('starts only one hold at a time and ignores a hold when disabled', () => {
    const onComplete = vi.fn();
    const { result, rerender } = renderHook(({ disabled }) => useHoldToActivate({ onComplete, disabled }), {
      initialProps: { disabled: false },
    });
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS - 1000));
    expect(onComplete).toHaveBeenCalledTimes(1);

    rerender({ disabled: true });
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops when the screen goes away', () => {
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() => useHoldToActivate({ onComplete }));
    act(() => result.current.start());
    unmount();
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
