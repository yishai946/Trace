import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReportFix } from '.';

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

const fix = { coords: { latitude: 31.78, longitude: 35.13, accuracy: 6 }, timestamp: 1_700_000_000_000 };

beforeEach(() => {
  location.get.mockReset().mockResolvedValue({ granted: true });
  location.request.mockReset().mockResolvedValue({ granted: false });
  location.position.mockReset().mockResolvedValue(fix);
});

describe('useReportFix', () => {
  it('is locating until the fix arrives, then ready with the position', async () => {
    const { result } = renderHook(() => useReportFix());
    expect(result.current).toEqual({ state: 'locating', fix: null });
    await waitFor(() =>
      expect(result.current).toEqual({
        state: 'ready',
        fix: { position: [35.13, 31.78], accuracy: 6, at: 1_700_000_000_000 },
      }),
    );
  });

  it('asks for the permission once when it is not granted yet', async () => {
    location.get.mockResolvedValue({ granted: false });
    location.request.mockResolvedValue({ granted: true });
    const { result } = renderHook(() => useReportFix());
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(location.request).toHaveBeenCalledTimes(1);
  });

  it('is unavailable when the permission is denied', async () => {
    location.get.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useReportFix());
    await waitFor(() => expect(result.current).toEqual({ state: 'unavailable', fix: null }));
    expect(location.position).not.toHaveBeenCalled();
  });

  it('is unavailable when the phone gives no position', async () => {
    location.position.mockRejectedValue(new Error('no gps'));
    const { result } = renderHook(() => useReportFix());
    await waitFor(() => expect(result.current).toEqual({ state: 'unavailable', fix: null }));
  });
});
