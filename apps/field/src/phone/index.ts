import { Linking } from 'react-native';

/** The emergency number shown on the SOS screen (wireframe Fm12; the GSM emergency number, which also works without a SIM). */
export const EMERGENCY_NUMBER = '112';

/** Opens the phone's regular dialer with the number (UC-F14: no VoIP in TRACE). Resolves false when it cannot open. */
export async function dial(number: string): Promise<boolean> {
  try {
    await Linking.openURL(`tel:${number}`);
    return true;
  } catch {
    return false;
  }
}
