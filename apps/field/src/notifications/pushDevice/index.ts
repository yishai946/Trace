import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android needs a channel before the permission prompt (Android 13) and before a token. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'TRACE',
    importance: Notifications.AndroidImportance.MAX,
  });
}

/**
 * This device's Expo push token, or null while notifications are not allowed. `ask` lets it show the system prompt
 * when the searcher has not decided yet. Throws when the token cannot be had (no EAS project yet, no network).
 */
export async function readPushToken({ ask }: { ask: boolean }): Promise<string | null> {
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && ask && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return null;
  return (await Notifications.getExpoPushTokenAsync()).data;
}
