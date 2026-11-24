import { Linking } from 'react-native';

/** The emergency number shown on the SOS screen (UC-F14; the owner chose 100, the wireframe Fm12 still shows 112). */
export const EMERGENCY_NUMBER = '100';

/** Opens the phone's regular dialer with the number (UC-F14: no VoIP in TRACE). Resolves false when it cannot open. */
export async function dial(number: string): Promise<boolean> {
  try {
    await Linking.openURL(`tel:${number}`);
    return true;
  } catch {
    return false;
  }
}
