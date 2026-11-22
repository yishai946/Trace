import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIX_TIMEOUT_MS, useCurrentFix } from '.';

const location = vi.hoisted(() => ({
  get: vi.fn(),
  request: vi.fn(),
  position: vi.fn(),
}));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: location.get,
  requestForegroundPermissionsAsync: location.request,
  getCurrentPositionAsync: location.position,
}));

beforeEach(() => {
  location.get.mockReset().mockResolvedValue({ granted: true });
  location.request.mockReset().mockResolvedValue({ granted: true });
  location.position
    .mockReset()
    .mockResolvedValue({ coords: { latitude: 31.7412, longitude: 35.0139, accuracy: 6 }, timestamp: 1000 });
});

describe('useCurrentFix', () => {
  it('is locating, then ready with the position as [lng, lat]', async () => {
    const { result } = renderHook(() => useCurrentFix());
    expect(result.current).toEqual({ state: 'locating', fix: null });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.fix).toEqual({ position: [35.0139, 31.7412], accuracy: 6, at: 1000 });
    expect(location.request).not.toHaveBeenCalled();
  });

  it('asks for permission once when it is not granted', async () => {
    location.get.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useCurrentFix());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(location.request).toHaveBeenCalledTimes(1);
  });

  it('is unavailable when permission is denied', async () => {
    location.get.mockResolvedValue({ granted: false });
    location.request.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useCurrentFix());
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
    expect(result.current.fix).toBeNull();
    expect(location.position).not.toHaveBeenCalled();
  });

  it('is unavailable when the phone gives no fix', async () => {
    location.position.mockRejectedValue(new Error('no fix'));
    const { result } = renderHook(() => useCurrentFix());
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
    expect(result.current.fix).toBeNull();
  });

  it('does not ask for permission when told not to prompt, and is unavailable without it', async () => {
    location.get.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useCurrentFix({ prompt: false }));
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
    expect(location.request).not.toHaveBeenCalled();
    expect(location.position).not.toHaveBeenCalled();
  });

  it('takes the fix without prompting when permission was already granted', async () => {
    const { result } = renderHook(() => useCurrentFix({ prompt: false }));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(location.request).not.toHaveBeenCalled();
  });

  it('gives up and is unavailable when the phone takes too long for a fix', async () => {
    vi.useFakeTimers();
    try {
      location.position.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useCurrentFix());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIX_TIMEOUT_MS);
      });
      expect(result.current).toEqual({ state: 'unavailable', fix: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the fix when the timeout passes after it arrived', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCurrentFix());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIX_TIMEOUT_MS + 1000);
      });
      expect(result.current.state).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a fix that arrives after the timeout', async () => {
    vi.useFakeTimers();
    try {
      let arrive: (value: unknown) => void = () => {};
      location.position.mockReturnValue(new Promise((resolve) => (arrive = resolve)));
      const { result } = renderHook(() => useCurrentFix());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIX_TIMEOUT_MS);
      });
      await act(async () => arrive({ coords: { latitude: 31, longitude: 35, accuracy: 5 }, timestamp: 1 }));
      expect(result.current).toEqual({ state: 'unavailable', fix: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not count the time the person takes to answer the permission prompt', async () => {
    vi.useFakeTimers();
    try {
      let answer: (value: unknown) => void = () => {};
      location.get.mockResolvedValue({ granted: false });
      location.request.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      const { result } = renderHook(() => useCurrentFix());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FIX_TIMEOUT_MS * 2);
      });
      expect(result.current.state).toBe('locating');
      await act(async () => answer({ granted: true }));
      expect(result.current.state).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });
});
