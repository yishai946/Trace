import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentFix } from '.';

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
});
