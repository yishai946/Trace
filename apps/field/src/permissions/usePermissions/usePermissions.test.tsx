import { act, renderHook, waitFor } from '@testing-library/react';
import { Linking } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissions } from '.';

const device = vi.hoisted(() => ({ read: vi.fn(), request: vi.fn() }));
vi.mock('../devicePermissions', () => ({ readPermissions: device.read, requestPermission: device.request }));

const all = (state: string) => ({ location: state, backgroundLocation: state, push: state, camera: state });

beforeEach(() => {
  device.read.mockReset();
  device.request.mockReset();
});

describe('usePermissions', () => {
  it('has nothing until the phone answers, then what it allows', async () => {
    device.read.mockResolvedValue(all('ask'));
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions).toBeNull();
    await waitFor(() => expect(result.current.permissions).toEqual(all('ask')));
  });

  it('asks the phone and reads again after the searcher decides', async () => {
    device.read.mockResolvedValueOnce(all('ask')).mockResolvedValue({ ...all('ask'), push: 'granted' });
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.permissions).not.toBeNull());
    await act(() => result.current.grant('push'));
    expect(device.request).toHaveBeenCalledWith('push');
    await waitFor(() => expect(result.current.permissions?.push).toBe('granted'));
  });

  it('opens the phone settings instead of asking when the searcher refused for good', async () => {
    // react-native-web has no openSettings; the phone does.
    const openSettings = vi.fn().mockResolvedValue(undefined);
    Object.assign(Linking, { openSettings });
    device.read.mockResolvedValue(all('blocked'));
    const { result } = renderHook(() => usePermissions());
    await waitFor(() => expect(result.current.permissions).not.toBeNull());
    await act(() => result.current.grant('location'));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(device.request).not.toHaveBeenCalled();
  });
});
