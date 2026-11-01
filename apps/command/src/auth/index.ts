import { AuthSession, type SignInBody } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiRequest } from '../api';

export const sessionKey = ['session'] as const;

/** The signed-in commander, or null. The session itself is an HttpOnly cookie the API sets. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => apiRequest('/auth/get-session', { schema: AuthSession, signal }),
    staleTime: Infinity,
    retry: false,
  });
}

/** Signs in with email and password (UC-C01), then reloads the session. */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SignInBody) => apiRequest('/auth/sign-in/email', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKey }),
  });
}

/**
 * Signs out and drops every cached response, so the next user starts clean. Only after the server revoked the
 * session: if the request fails, the cookie is still valid and the console stays signed in (a 401 is handled by the
 * global handler in main.tsx).
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/auth/sign-out', { method: 'POST', body: {} }),
    onSuccess: () => signedOut(queryClient),
  });
}

/** Shows the login screen: clears cached data and marks the session as gone. */
export function signedOut(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
  queryClient.setQueryData(sessionKey, null);
}

/** A request answered 401: the session expired or was revoked. */
export const isSignedOutError = (error: unknown) => error instanceof ApiRequestError && error.status === 401;

const SIGN_IN_MESSAGES: Record<number, string> = {
  0: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
  401: 'האימייל או הסיסמה שגויים. בדקו ונסו שוב.',
  429: 'יותר מדי ניסיונות כניסה. המתינו דקה ונסו שוב.',
};

/** A Hebrew message for a failed sign-in. Better Auth errors do not use the API's error shape, so go by status. */
export function signInErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && SIGN_IN_MESSAGES[error.status]) || 'הכניסה נכשלה. נסו שוב.';
}
