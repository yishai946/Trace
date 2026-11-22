import { setNotificationHandler } from 'expo-notifications';
import { foregroundBehavior } from './foreground';
import { useNotificationTaps } from './useNotificationTaps';
import { usePushRegistration } from './usePushRegistration';

// At load, before any screen: what to do with a notification that arrives while the app is open.
setNotificationHandler({
  handleNotification: async (notification) => foregroundBehavior(notification.request.content.data),
});

/** Push notifications (UC-C14, UC-C12): registers the device's token and opens the screen a tapped one names. */
export function useNotifications(): void {
  usePushRegistration();
  useNotificationTaps();
}
