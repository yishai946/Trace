import * as SecureStore from 'expo-secure-store';

// On the web SecureStore is unavailable, so every call below fails quietly and nothing persists there.
const KEY = 'trace.session-token';
// After first unlock: background GPS uploads must read the token while the phone is locked.
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** The session token saved on the device, or null when there is none or the device cannot read it. */
export async function loadToken(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(KEY, options)) || null;
  } catch {
    return null;
  }
}

/** Saves the token on the device. False when the device refuses; signing in must not depend on it. */
export async function saveToken(token: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(KEY, token, options);
    return true;
  } catch {
    return false;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY, options);
  } catch {
    // Nothing stored, or the device cannot reach its store: either way there is nothing left to forget.
  }
}
