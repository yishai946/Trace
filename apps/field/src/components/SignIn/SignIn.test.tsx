import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignIn } from '.';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';
import { secureStoreItems } from '../../test/secureStore';

const SEND = 'https://api.test/api/auth/phone-number/send-otp';
const VERIFY = 'https://api.test/api/auth/phone-number/verify';
const ME = 'https://api.test/api/searchers/me';
const profile = { id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11', phone: '+972501234567', name: 'דנה כהן' };
const codeLabel = 'קוד אימות, 6 ספרות';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

type Handler = (init: RequestInit) => Response | Promise<Response>;
function stubApi(handlers: { send?: Handler; verify?: Handler; me?: Handler }) {
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    if (url === SEND) return (handlers.send ?? (() => json(200, { message: 'code sent' })))(init);
    if (url === VERIFY) return (handlers.verify ?? (() => json(200, {})))(init);
    if (url === ME) return (handlers.me ?? (() => json(404, { error: { code: 'NOT_FOUND', message: 'x' } })))(init);
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const callsTo = (fetch: ReturnType<typeof stubApi>, url: string) => fetch.mock.calls.filter(([u]) => u === url);

const wrongCode = () => json(400, { code: 'INVALID_OTP', message: 'Invalid OTP' });

async function enterPhone(phone = '050-123 4567') {
  fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: phone } });
  fireEvent.click(screen.getByRole('button', { name: 'שלח קוד' }));
}
async function toCodeStep() {
  await enterPhone();
  await screen.findByRole('heading', { name: 'הזן את הקוד שנשלח אליך' });
}
const typeCode = (code: string) => fireEvent.change(screen.getByLabelText(codeLabel), { target: { value: code } });

beforeEach(() => useSession.setState(useSession.getInitialState()));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SignIn', () => {
  it('sends a code to the normalized number and moves to the code step', async () => {
    const fetch = stubApi({});
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    expect(screen.getByRole('heading', { name: 'הזן מספר טלפון' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '052-340 1187' } });
    fireEvent.click(screen.getByRole('button', { name: 'שלח קוד' }));

    await screen.findByRole('heading', { name: 'הזן את הקוד שנשלח אליך' });
    expect(JSON.parse(callsTo(fetch, SEND)[0]![1].body as string)).toEqual({ phoneNumber: '+972523401187' });
    expect(screen.getByText(/052-340-1187/)).toBeInTheDocument();
    expect(screen.getByLabelText('שלב 2 מתוך 2, אימות')).toBeInTheDocument();
  });

  it('rejects an invalid number without sending', async () => {
    const fetch = stubApi({});
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await enterPhone('123');

    expect(await screen.findByRole('alert')).toHaveTextContent('מספר הטלפון לא תקין');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the server's per-number limit", async () => {
    stubApi({ send: () => json(429, { code: 'TOO_MANY_OTP_REQUESTS' }, { 'retry-after': '42' }) });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await enterPhone();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ביקשת יותר מדי קודים');
    expect(alert).toHaveTextContent('00:42');
  });

  it('shows a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await enterPhone();

    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור לשרת');
  });

  it("a wrong code shows an error and a 'שלח קוד חדש' button", async () => {
    stubApi({ verify: wrongCode });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('000000');

    expect(await screen.findByRole('alert')).toHaveTextContent('הקוד שגוי או שפג תוקפו');
    await waitFor(() => expect(screen.getByLabelText(codeLabel)).toHaveValue(''));
    expect(screen.getByLabelText(codeLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'שלח קוד חדש' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the resend failure, not the earlier wrong-code error', async () => {
    let sends = 0;
    stubApi({
      verify: wrongCode,
      send: () => (++sends === 1 ? json(200, {}) : json(429, {}, { 'retry-after': '30' })),
    });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('000000');
    await screen.findByText(/הקוד שגוי או שפג תוקפו/);

    fireEvent.click(screen.getByRole('button', { name: 'שלח קוד חדש' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ביקשת יותר מדי קודים'));
  });

  it('shows a wrong code after an earlier resend failure', async () => {
    let sends = 0;
    stubApi({ verify: wrongCode, send: () => (++sends === 1 ? json(200, {}) : json(500, {})) });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    fireEvent.click(screen.getByRole('button', { name: 'שלח קוד חדש' }));
    await screen.findByText('שליחת הקוד נכשלה. נסה שוב.');

    typeCode('000000');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('הקוד שגוי או שפג תוקפו'));
  });

  it('an expired code shows the same error', async () => {
    stubApi({ verify: () => json(400, { code: 'OTP_EXPIRED', message: 'OTP expired' }) });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent('הקוד שגוי או שפג תוקפו');
  });

  it('too many wrong tries asks for a new code', async () => {
    stubApi({ verify: () => json(403, { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts' }) });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent('יותר מדי ניסיונות שגויים');
  });

  it("'שלח קוד חדש' sends a new code to the same number and clears the error", async () => {
    const fetch = stubApi({ verify: wrongCode });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('000000');
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'שלח קוד חדש' }));

    expect(await screen.findByText('נשלח קוד חדש')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const sends = callsTo(fetch, SEND);
    expect(sends).toHaveLength(2);
    expect(JSON.parse(sends[1]![1].body as string)).toEqual({ phoneNumber: '+972501234567' });
  });

  it("waits for the server's limit before another code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let sends = 0;
    stubApi({
      send: () =>
        ++sends === 1 ? json(200, {}) : json(429, { code: 'TOO_MANY_OTP_REQUESTS' }, { 'retry-after': '2' }),
    });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();

    fireEvent.click(screen.getByRole('button', { name: 'שלח קוד חדש' }));
    const waiting = await screen.findByRole('button', { name: /שלח קוד חדש בעוד/ });
    expect(waiting).toHaveTextContent('00:02');
    expect(waiting).toHaveAttribute('aria-disabled', 'true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByRole('button', { name: 'שלח קוד חדש' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('a right code signs in and keeps the session on the device', async () => {
    const onSignedIn = vi.fn();
    const fetch = stubApi({ verify: () => json(200, { status: true, token: 't1', user: { id: 'u1' } }) });
    render(<SignIn onSignedIn={onSignedIn} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(useSession.getState().token).toBe('t1');
    expect(secureStoreItems.get('trace.session-token')).toBe('t1');
    expect(JSON.parse(callsTo(fetch, VERIFY)[0]![1].body as string)).toEqual({
      phoneNumber: '+972501234567',
      code: '123456',
    });
  });

  it('stays on the code step when the profile cannot be loaded after a right code, until it can', async () => {
    const onSignedIn = vi.fn();
    let profileCalls = 0;
    const fetch = stubApi({
      verify: () => json(200, { status: true, token: 't1', user: { id: 'u1' } }),
      me: () => (++profileCalls === 1 ? json(500, {}) : json(404, { error: { code: 'NOT_FOUND', message: 'x' } })),
    });
    render(<SignIn onSignedIn={onSignedIn} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    expect(await screen.findByRole('alert')).toHaveTextContent('הכניסה הצליחה, אבל טעינת הפרופיל נכשלה');
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(useSession.getState().token).toBe('t1');

    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(callsTo(fetch, VERIFY)).toHaveLength(1);
    expect(callsTo(fetch, ME)).toHaveLength(2);
  });

  it('signs in for a returning searcher whose profile exists', async () => {
    const onSignedIn = vi.fn();
    stubApi({
      verify: () => json(200, { status: true, token: 't1', user: { id: 'u1' } }),
      me: () => json(200, profile),
    });
    render(<SignIn onSignedIn={onSignedIn} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
  });

  it("'שנה מספר' returns to the phone step with the number kept", async () => {
    stubApi({});
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();

    fireEvent.click(screen.getByRole('button', { name: 'שנה מספר' }));

    expect(screen.getByRole('heading', { name: 'הזן מספר טלפון' })).toBeInTheDocument();
    expect(screen.getByLabelText('מספר טלפון')).toHaveValue('050-123 4567');
  });

  it('verifies only once while a request is pending', async () => {
    const fetch = stubApi({ verify: () => new Promise<Response>(() => {}) });
    render(<SignIn onSignedIn={() => {}} />, { wrapper: TestProviders });
    await toCodeStep();
    typeCode('123456');

    const button = await screen.findByRole('button', { name: 'מאמת…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(callsTo(fetch, VERIFY)).toHaveLength(1);
  });
});
