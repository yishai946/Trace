import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  type NotificationResponse,
} from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { openScreen } from '../../navigation/navigate';
import { useSession } from '../../state/session';
import { pushTarget, type PushTarget } from '../pushTarget';

const targetOf = (response: NotificationResponse) => pushTarget(response.notification.request.content.data);

/**
 * Opens the screen a tapped push notification names (`data.screen` of `data.missionId`), also when the tap started
 * the app. The mission screens read the mission the searcher joined, so a tap waits until that mission is open
 * (a launch joins it again, UC-F16) and is dropped when the searcher is in another one. Does nothing on web.
 */
export function useNotificationTaps(): void {
  const router = useRouter();
  const pending = useRef<PushTarget | null>(null);

  useEffect(() => {
    // The web build has no native notification module (getLastNotificationResponse is missing there).
    if (Platform.OS === 'web') return;
    function open() {
      const target = pending.current;
      const { missionId } = useSession.getState();
      if (!target || !missionId) return;
      pending.current = null;
      if (target.missionId === missionId) openScreen(router, target.href);
    }
    function accept(response: NotificationResponse) {
      pending.current = targetOf(response);
      open();
    }

    const started = getLastNotificationResponse();
    if (started) {
      clearLastNotificationResponse();
      accept(started);
    }
    const subscription = addNotificationResponseReceivedListener(accept);
    const unsubscribe = useSession.subscribe(open);
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [router]);
}
