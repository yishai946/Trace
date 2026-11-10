import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneSignIn, SearcherProfile } from '@trace/schemas';
import { useEffect } from 'react';
import { apiBaseUrl, apiRequest, ApiRequestError } from '../api';
import { ltr } from '../i18n/rtl';
import { routes } from '../navigation/routes';
import { useSession } from '../state/session';

export const searcherKeys = { me: (token: string | null) => ['searchers', 'me', token] as const };

/** POST /api/auth/phone-number/send-otp: sends a sign-in code to the phone (UC-F01). `phoneNumber` is E.164. */
export const sendCode = (phoneNumber: string) =>
  apiRequest('/auth/phone-number/send-otp', {
    baseUrl: apiBaseUrl,
    token: null,
    method: 'POST',
    body: { phoneNumber },
  });

/** POST /api/auth/phone-number/verify: the session of a right code; the first code of a number creates the searcher. */
export const verifyCode = (phoneNumber: string, code: string) =>
  apiRequest('/auth/phone-number/verify', {
    baseUrl: apiBaseUrl,
    token: null,
    method: 'POST',
    body: { phoneNumber, code },
    schema: PhoneSignIn,
  });

/** The signed-in searcher's profile. It is a 404 until the searcher enters a name. */
export function useSearcherProfile() {
  const { token, restored } = useSession();
  return useQuery({
    queryKey: searcherKeys.me(token),
    queryFn: ({ signal }) =>
      apiRequest('/searchers/me', { baseUrl: apiBaseUrl, token, schema: SearcherProfile, signal }),
    enabled: restored && !!token,
    retry: false,
  });
}

/** PUT /api/searchers/me: saves the name entered on first sign-in. */
export function useSaveName() {
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest('/searchers/me', {
        baseUrl: apiBaseUrl,
        token,
        method: 'PUT',
        body: { name },
        schema: SearcherProfile,
      }),
    onSuccess: (profile) => queryClient.setQueryData(searcherKeys.me(token), profile),
  });
}

export type StartRoute = typeof routes.login | typeof routes.join | typeof routes.name;

/**
 * Where the app opens (UC-F01): sign-in, the name on first sign-in, or the app for a returning searcher. Null while
 * that is not known yet. A saved session survives a server that cannot be reached; only a refusal ends it.
 */
export function useStartRoute(): StartRoute | null {
  const { token, restored, signOut } = useSession();
  const profile = useSearcherProfile();
  const status = profile.error instanceof ApiRequestError ? profile.error.status : null;
  const unauthenticated = !!token && status === 401;

  useEffect(() => {
    if (unauthenticated) void signOut();
  }, [unauthenticated, signOut]);

  if (!restored) return null;
  if (!token || unauthenticated) return routes.login;
  if (profile.isSuccess) return routes.join;
  if (profile.isError) return status === 404 ? routes.name : routes.join;
  return null;
}

/** `42` as `00:42`. */
export function formatCountdown(seconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

const NETWORK = 'אין חיבור לשרת. בדוק את החיבור ונסה שוב.';
const status = (error: unknown) => (error instanceof ApiRequestError ? error.status : null);

export const INVALID_PHONE = `מספר הטלפון לא תקין. הזן מספר נייד, למשל ${ltr('050-1234567')}.`;

/** Better Auth errors do not use the API's error shape, so the message goes by status. */
export function sendCodeErrorMessage(error: unknown): string {
  const code = status(error);
  if (code === 0) return NETWORK;
  if (code === 400) return INVALID_PHONE;
  if (code === 429) {
    const wait = error instanceof ApiRequestError ? error.retryAfter : undefined;
    const base = 'ביקשת יותר מדי קודים למספר הזה.';
    return wait === undefined ? `${base} נסה שוב מאוחר יותר.` : `${base} נסה שוב בעוד ${ltr(formatCountdown(wait))}.`;
  }
  return 'שליחת הקוד נכשלה. נסה שוב.';
}

export function verifyErrorMessage(error: unknown): string {
  const code = status(error);
  if (code === 0) return NETWORK;
  if (code === 400) return 'הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.';
  if (code === 403) return 'יותר מדי ניסיונות שגויים. בקש קוד חדש.';
  return 'האימות נכשל. נסה שוב.';
}

export function saveNameErrorMessage(error: unknown): string {
  const code = status(error);
  if (code === 0) return NETWORK;
  if (code === 400) return 'השם לא תקין.';
  return 'שמירת השם נכשלה. נסה שוב.';
}
