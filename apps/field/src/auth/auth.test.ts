import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCountdown,
  saveNameErrorMessage,
  sendCode,
  sendCodeErrorMessage,
  useStartRoute,
  verifyCode,
  verifyErrorMessage,
} from '.';
import { ApiRequestError } from '../api';
import { routes } from '../navigation/routes';
import { useSession } from '../state/session';
import { secureStoreItems } from '../test/secureStore';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const profile = { id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11', phone: '+972523401187', name: 'דנה כהן' };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => useSession.setState(useSession.getInitialState()));
afterEach(() => vi.unstubAllGlobals());

describe('useStartRoute', () => {
  it('waits until the saved session was read', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    expect(result.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens sign-in without a saved session', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ restored: true, token: null });
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    expect(result.current).toBe(routes.login);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks for the name on first sign-in', async () => {
    const fetch = vi.fn().mockResolvedValue(json(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ restored: true, token: 't1' });
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    await waitFor(() => expect(result.current).toBe(routes.name));
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/searchers/me',
      expect.objectContaining({ headers: { authorization: 'Bearer t1' } }),
    );
  });

  it('skips the name for a returning searcher', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, profile)));
    useSession.setState({ restored: true, token: 't1' });
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    await waitFor(() => expect(result.current).toBe(routes.join));
  });

  it('signs out when the saved session is no longer valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })));
    secureStoreItems.set('trace.session-token', 't1');
    useSession.setState({ restored: true, token: 't1' });
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    await waitFor(() => expect(result.current).toBe(routes.login));
    await waitFor(() => expect(useSession.getState().token).toBeNull());
    expect(secureStoreItems.has('trace.session-token')).toBe(false);
  });

  it('keeps the searcher signed in when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    useSession.setState({ restored: true, token: 't1' });
    const { result } = renderHook(() => useStartRoute(), { wrapper });
    await waitFor(() => expect(result.current).toBe(routes.join));
    expect(useSession.getState().token).toBe('t1');
  });
});

describe('sign-in requests', () => {
  it('sends the code request without an authorization header', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { message: 'code sent' }));
    vi.stubGlobal('fetch', fetch);
    await sendCode('+972501234567');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/auth/phone-number/send-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: '+972501234567' }),
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('returns the token of a right code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { status: true, token: 't1', user: { id: 'u1' } })));
    await expect(verifyCode('+972501234567', '123456')).resolves.toMatchObject({ token: 't1' });
  });

  it('rejects a response without a token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { status: true, token: null, user: { id: 'u1' } })));
    await expect(verifyCode('+972501234567', '123456')).rejects.toMatchObject({ name: 'ZodError' });
  });
});

const failure = (status: number, retryAfter?: number) =>
  new ApiRequestError(status, status === 0 ? 'NETWORK_ERROR' : 'INTERNAL_ERROR', 'x', undefined, retryAfter);

describe('error messages', () => {
  const network = 'אין חיבור לשרת. בדוק את החיבור ונסה שוב.';

  it('explains a refused code request', () => {
    expect(sendCodeErrorMessage(failure(400))).toContain('מספר הטלפון לא תקין');
    expect(sendCodeErrorMessage(failure(429, 42))).toContain('ביקשת יותר מדי קודים למספר הזה. נסה שוב בעוד');
    expect(sendCodeErrorMessage(failure(429, 42))).toContain('00:42');
    expect(sendCodeErrorMessage(failure(429))).toBe('ביקשת יותר מדי קודים למספר הזה. נסה שוב מאוחר יותר.');
    expect(sendCodeErrorMessage(failure(0))).toBe(network);
    expect(sendCodeErrorMessage(failure(500))).toBe('שליחת הקוד נכשלה. נסה שוב.');
  });

  it('explains a refused code', () => {
    expect(verifyErrorMessage(failure(400))).toBe('הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.');
    expect(verifyErrorMessage(failure(403))).toBe('יותר מדי ניסיונות שגויים. בקש קוד חדש.');
    expect(verifyErrorMessage(failure(0))).toBe(network);
    expect(verifyErrorMessage(failure(500))).toBe('האימות נכשל. נסה שוב.');
  });

  it('explains a refused name', () => {
    expect(saveNameErrorMessage(failure(400))).toBe('השם לא תקין.');
    expect(saveNameErrorMessage(failure(0))).toBe(network);
    expect(saveNameErrorMessage(failure(500))).toBe('שמירת השם נכשלה. נסה שוב.');
    expect(saveNameErrorMessage(new Error('x'))).toBe('שמירת השם נכשלה. נסה שוב.');
  });
});

describe('formatCountdown', () => {
  it('writes seconds as minutes and seconds', () => {
    expect(formatCountdown(42)).toBe('00:42');
    expect(formatCountdown(75)).toBe('01:15');
  });
});
