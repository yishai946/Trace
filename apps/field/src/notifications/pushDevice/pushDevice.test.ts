import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPushToken } from '.';

vi.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 5 },
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
}));

const permission = (status: string, canAskAgain = true) =>
  ({ status, canAskAgain }) as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[abc]' });
});

describe('readPushToken', () => {
  it('returns the Expo token when notifications are allowed, without asking again', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('granted'));
    expect(await readPushToken({ ask: true })).toBe('ExponentPushToken[abc]');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for permission once when it is not decided and `ask` is set', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(permission('granted'));
    expect(await readPushToken({ ask: true })).toBe('ExponentPushToken[abc]');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not ask when `ask` is not set, and returns null', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    expect(await readPushToken({ ask: false })).toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when the searcher turned notifications off', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('denied', false));
    expect(await readPushToken({ ask: true })).toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when the searcher refuses the prompt', async () => {
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('undetermined'));
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(permission('denied'));
    expect(await readPushToken({ ask: true })).toBeNull();
  });

  it('creates the Android channel before the token, which Android 13 needs for the prompt', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    try {
      vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission('granted'));
      await readPushToken({ ask: true });
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.anything());
    } finally {
      Platform.OS = os;
    }
  });
});
