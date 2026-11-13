import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mission, participants, reportFinding } from '../mission/fixtures';
import { ThemeProvider } from '../theme/theme';
import { App } from '.';

const user = { id: '00000000-0000-4000-8000-0000000000c1', name: 'רונית לוי', role: 'commander' };

// The map needs WebGL, and the live channel a server; stand-ins keep the screen under test.
vi.mock('../map/provider', () => ({ getMapProvider: () => ({}) }));
vi.mock('../map/MissionMap', () => ({ MissionMap: () => <div /> }));
vi.mock('../map/PlaceSearch', () => ({ PlaceSearch: () => null }));
vi.mock('../realtime', () => ({ useMissionLive: () => 'live' }));
vi.mock('../hooks/useOnline', () => ({ useOnline: () => true }));
vi.mock('../auth', () => ({
  sessionKey: ['session'],
  useSession: () => ({ isPending: false, data: { user } }),
  useSignOut: () => ({ mutate: () => {}, isPending: false, isError: false }),
}));

const json = (body: unknown) => new Response(JSON.stringify(body));

function renderApp() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith('/health'))
      return Promise.resolve(json({ status: 'ok', version: '1', time: '2026-11-08T00:00:00Z' }));
    if (url.endsWith('/polygons')) return Promise.resolve(json([]));
    if (url.endsWith('/participants')) return Promise.resolve(json(participants));
    if (url.endsWith('/messages')) return Promise.resolve(json([]));
    if (url.endsWith('/reports')) return Promise.resolve(json([]));
    return Promise.resolve(json([mission]));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

async function openDetails() {
  fireEvent.click(await screen.findByText(mission.name));
  const button = await screen.findByRole('button', { name: 'פרטי מסע' });
  fireEvent.click(button);
  return button;
}

describe('App mission details', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the theme provider reads it.
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as never;
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens the details without a React error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp();
    await openDetails();
    expect(await screen.findByRole('form', { name: 'פרטי מסע ונעדר' })).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
  });

  it('returns focus to the details button when the screen is closed', async () => {
    renderApp();
    const button = await openDetails();
    fireEvent.click(await screen.findByRole('button', { name: 'בטל' }));
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('opens the messages screen from the mission navigation', async () => {
    renderApp();
    fireEvent.click(await screen.findByText(mission.name));
    fireEvent.click(await screen.findByRole('link', { name: 'הודעות' }));

    expect(await screen.findByRole('heading', { name: 'הודעה חדשה' })).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch).mock.calls.map(([input]) => String(input))).toContain(
        `/api/missions/${mission.id}/messages`,
      ),
    );
    expect(await screen.findByText('עוד לא נשלחו הודעות במסע הזה.')).toBeInTheDocument();
  });

  it('opens the reports screen from the mission navigation', async () => {
    renderApp();
    fireEvent.click(await screen.findByText(mission.name));
    fireEvent.click(await screen.findByRole('link', { name: 'דיווחים' }));

    expect(await screen.findByRole('heading', { name: 'דיווחים' })).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch).mock.calls.map(([input]) => String(input))).toContain(
        `/api/missions/${mission.id}/reports`,
      ),
    );
    expect(await screen.findByText('עוד לא התקבלו דיווחים במסע הזה.')).toBeInTheDocument();
  });

  it('N1: sends one delete request when the confirmation is pressed twice at once', async () => {
    renderApp();
    const calls = () => vi.mocked(globalThis.fetch).mock.calls;
    vi.mocked(globalThis.fetch).mockImplementation(((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/reports/${reportFinding.id}`) && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith('/reports')) return Promise.resolve(json([reportFinding]));
      if (url.endsWith('/health'))
        return Promise.resolve(json({ status: 'ok', version: '1', time: '2026-11-08T00:00:00Z' }));
      if (url.endsWith('/polygons')) return Promise.resolve(json([]));
      if (url.endsWith('/participants')) return Promise.resolve(json(participants));
      return Promise.resolve(json([mission]));
    }) as never);
    fireEvent.click(await screen.findByText(mission.name));
    fireEvent.click(await screen.findByRole('link', { name: /דיווחים/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'מחק' }));
    const confirm = await screen.findByRole('button', { name: 'מחק דיווח' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(calls().filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1));
  });
});
