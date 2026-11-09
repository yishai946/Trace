import { themes } from '@trace/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NameForm } from '.';
import { searcherKeys } from '../../auth';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const ME = 'https://api.test/api/searchers/me';
const profile = { id: '6f1c5b3e-8d0a-4e57-9a43-0b0f5a1a2c11', phone: '+972523401187', name: 'דנה כהן' };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true }));
afterEach(() => {
  vi.unstubAllGlobals();
  usePreferences.setState(usePreferences.getInitialState());
});

const submit = (name: string) => {
  fireEvent.change(screen.getByLabelText('שם מלא'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'שמור והמשך' }));
};

describe('NameForm', () => {
  it('saves the trimmed name with the session token', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, profile));
    vi.stubGlobal('fetch', fetch);
    const onSaved = vi.fn();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <NameForm onSaved={onSaved} onSignedOut={() => {}} />
      </QueryClientProvider>,
      { wrapper: TestProviders },
    );
    submit('  דנה כהן  ');

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      ME,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'דנה כהן' }),
        headers: { authorization: 'Bearer t1', 'content-type': 'application/json' },
      }),
    );
    expect(client.getQueryData(searcherKeys.me('t1'))).toEqual(profile);
  });

  it('asks for a name before sending', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<NameForm onSaved={() => {}} onSignedOut={() => {}} />, { wrapper: TestProviders });
    fireEvent.click(screen.getByRole('button', { name: 'שמור והמשך' }));

    expect(screen.getByRole('alert')).toHaveTextContent('הזן שם.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a server refusal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: { code: 'VALIDATION_ERROR', message: 'x' } })));
    render(<NameForm onSaved={() => {}} onSignedOut={() => {}} />, { wrapper: TestProviders });
    submit('דנה');

    expect(await screen.findByRole('alert')).toHaveTextContent('השם לא תקין.');
  });

  it('shows a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    render(<NameForm onSaved={() => {}} onSignedOut={() => {}} />, { wrapper: TestProviders });
    submit('דנה');

    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור לשרת');
  });

  it('signs out when the session expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })));
    const onSignedOut = vi.fn();
    render(<NameForm onSaved={() => {}} onSignedOut={onSignedOut} />, { wrapper: TestProviders });
    submit('דנה');

    await waitFor(() => expect(onSignedOut).toHaveBeenCalledOnce());
    expect(useSession.getState().token).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<NameForm onSaved={() => {}} onSignedOut={() => {}} />, { wrapper: TestProviders });

    expect(screen.getByRole('heading', { name: 'הזן את שמך' })).toBeInTheDocument();
    expect(screen.getByTestId('auth-layout')).toHaveStyle({ backgroundColor: themes[id].color.surface });
  });
});
