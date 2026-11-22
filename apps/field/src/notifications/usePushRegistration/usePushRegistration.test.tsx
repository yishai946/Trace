import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePushRegistration } from '.';
import { readPushToken } from '../pushDevice';
import { useSession } from '../../state/session';

const tokenListeners = vi.hoisted(() => [] as (() => void)[]);
vi.mock('expo-notifications', () => ({
  addPushTokenListener: (listener: () => void) => {
    tokenListeners.push(listener);
    return { remove: () => tokenListeners.splice(tokenListeners.indexOf(listener), 1) };
  },
}));
vi.mock('../pushDevice', () => ({ readPushToken: vi.fn() }));

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`);
const bodies = () => fetchMock.mock.calls.map(([, init]) => init.body);

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(readPushToken).mockResolvedValue('ExponentPushToken[one]');
  useSession.setState({ token: 'tok' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  useSession.setState({ token: null });
});

describe('usePushRegistration', () => {
  it('registers the token once after sign-in, asking for permission', async () => {
    renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()).toEqual(['PUT https://api.test/api/push-token']);
    expect(bodies()).toEqual([JSON.stringify({ token: 'ExponentPushToken[one]' })]);
    expect(readPushToken).toHaveBeenCalledWith({ ask: true });
  });

  it('does nothing while signed out', async () => {
    useSession.setState({ token: null });
    renderHook(() => usePushRegistration());
    await act(async () => {});
    expect(readPushToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send the same token again when the device token event fires', async () => {
    renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => tokenListeners.forEach((listener) => listener()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readPushToken).toHaveBeenLastCalledWith({ ask: false });
  });

  it('sends the new token when it changes', async () => {
    renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.mocked(readPushToken).mockResolvedValue('ExponentPushToken[two]');
    await act(async () => tokenListeners.forEach((listener) => listener()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodies()[1]).toBe(JSON.stringify({ token: 'ExponentPushToken[two]' }));
  });

  it('removes the token when notifications are turned off', async () => {
    renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.mocked(readPushToken).mockResolvedValue(null);
    await act(async () => tokenListeners.forEach((listener) => listener()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(calls()[1]).toBe('DELETE https://api.test/api/push-token');
  });

  it('removes a token left on the server when notifications are off from the start', async () => {
    vi.mocked(readPushToken).mockResolvedValue(null);
    renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()).toEqual(['DELETE https://api.test/api/push-token']);
  });

  it('tries again later when the token cannot be read or sent', async () => {
    vi.mocked(readPushToken).mockRejectedValueOnce(new Error('no project id'));
    renderHook(() => usePushRegistration());
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => tokenListeners.forEach((listener) => listener()));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('stops listening when the hook unmounts', async () => {
    const { unmount } = renderHook(() => usePushRegistration());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();
    expect(tokenListeners).toHaveLength(0);
  });
});
