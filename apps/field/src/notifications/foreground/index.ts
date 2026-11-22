import type { NotificationBehavior } from 'expo-notifications';
import { pushTarget } from '../pushTarget';
import { routes } from '../../navigation/routes';

const shown: NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};
const hidden: NotificationBehavior = {
  ...shown,
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
};

/**
 * What to do with a notification that arrives while the app is open. An SOS is always shown (UC-C14); messages and
 * the rest already arrive over the live connection, so a banner would only repeat them.
 */
export function foregroundBehavior(data: unknown): NotificationBehavior {
  const target = pushTarget(data);
  return !target || target.href === routes.sos ? shown : hidden;
}
