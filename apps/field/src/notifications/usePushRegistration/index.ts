import { addPushTokenListener } from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { apiBaseUrl, apiRequest } from '../../api';
import { reportQueryError } from '../../monitoring';
import { useSession } from '../../state/session';
import { readPushToken } from '../pushDevice';

/** PUT /api/push-token: the server keeps one token per session and replaces it. */
const putPushToken = (token: string, expoToken: string) =>
  apiRequest('/push-token', { baseUrl: apiBaseUrl, token, method: 'PUT', body: { token: expoToken } });

/** DELETE /api/push-token: does nothing on the server when the session has no token. */
const deletePushToken = (token: string) => apiRequest('/push-token', { baseUrl: apiBaseUrl, token, method: 'DELETE' });

/**
 * Keeps the server's push token for this session equal to the device's (UC-C14, UC-C12): asks for permission after
 * sign-in, sends the Expo token once, sends it again when the device token changes or the app returns to the front,
 * and removes it when the searcher turns notifications off. Signing out removes it on the server.
 */
export function usePushRegistration(): void {
  const token = useSession((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const bearer = token;
    let active = true;
    let asked = false;
    // undefined: nothing is known yet; null: removed or never registered; string: what the server holds.
    let sent: string | null | undefined;
    let running = false;
    let again = false;

    async function sync() {
      if (running) {
        // A change that comes while one is on its way is handled right after it.
        again = true;
        return;
      }
      running = true;
      try {
        const expoToken = await readPushToken({ ask: !asked });
        asked = true;
        if (!active || expoToken === sent) return;
        if (expoToken) await putPushToken(bearer, expoToken);
        else await deletePushToken(bearer);
        sent = expoToken;
      } catch (error) {
        // `sent` stays as it was, so the next device token event or return to the front tries again.
        reportQueryError(error);
      } finally {
        running = false;
        if (again && active) {
          again = false;
          void sync();
        }
      }
    }

    void sync();
    const tokenSubscription = addPushTokenListener(() => void sync());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      active = false;
      tokenSubscription.remove();
      appState.remove();
    };
  }, [token]);
}
