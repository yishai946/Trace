import { QueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SosScreen } from '.';
import { missionKeys } from '../../mission/queries';
import { assigned, MISSION_ID } from '../../reports/fixtures';
import { SOS_HOLD_MS } from '../../sos/useHoldToActivate';
import { makeSos } from '../../sos/fixtures';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const network = vi.hoisted(() => ({ state: { isConnected: true, isInternetReachable: true } }));
vi.mock('expo-network', () => ({ getNetworkStateAsync: vi.fn(async () => network.state) }));
vi.mock('../../location/useCurrentFix', () => ({
  useCurrentFix: () => ({ state: 'ready', fix: { position: [35.0098, 31.7452], accuracy: 5, at: 1_790_000_000_000 } }),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const closedByCommander = makeSos({
  status: 'closed',
  closedAt: '2026-10-03T17:10:00.000Z',
  closedBy: { role: 'commander', name: 'רן' },
});

let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
let existing: unknown[] = [];

function posts(path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(path) && init?.method === 'POST');
}
const sosButton = () => screen.getByRole('button', { name: /הפעל SOS/ });
const hold = (ms: number) => {
  fireEvent.mouseDown(sosButton());
  act(() => vi.advanceTimersByTime(ms));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({
    ...useSession.getInitialState(),
    token: 't1',
    restored: true,
    missionId: MISSION_ID,
    participation: assigned,
  });
  existing = [];
  fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
    if (String(url).endsWith('/sos') && init?.method === 'POST') return json(makeSos({ message: 'נפלתי' }), 201);
    if (String(url).endsWith('/sos')) return json(existing);
    if (String(url).endsWith('/polygons')) return json([]);
    return json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  network.state = { isConnected: true, isInternetReachable: true };
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const view = () =>
  render(<SosScreen />, { wrapper: ({ children }) => <TestProviders client={client}>{children}</TestProviders> });

describe('SosScreen activation', () => {
  it('sends the SOS with the message and location after a 3 second hold and shows the active state with a close option', async () => {
    view();
    fireEvent.change(screen.getByLabelText('הודעה קצרה (אופציונלי)'), { target: { value: 'נפלתי' } });
    hold(SOS_HOLD_MS);
    await waitFor(() => expect(posts('/sos')).toHaveLength(1));
    expect(JSON.parse(posts('/sos')[0]?.[1].body)).toEqual({
      message: 'נפלתי',
      location: {
        position: { type: 'Point', coordinates: [35.0098, 31.7452] },
        recordedAt: new Date(1_790_000_000_000).toISOString(),
        accuracy: 5,
      },
    });
    expect(await screen.findByLabelText('SOS פעיל')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'בטל SOS…' })).toBeInTheDocument();
  });

  it('sends nothing when the button is released early or only tapped', () => {
    view();
    hold(SOS_HOLD_MS - 500);
    fireEvent.mouseUp(sosButton());
    act(() => vi.advanceTimersByTime(SOS_HOLD_MS));
    fireEvent.click(sosButton());
    expect(posts('/sos')).toHaveLength(0);
  });

  it('sends one SOS when the hold is repeated while sending', async () => {
    view();
    hold(SOS_HOLD_MS);
    hold(SOS_HOLD_MS);
    await waitFor(() => expect(screen.getByLabelText('SOS פעיל')).toBeInTheDocument());
    expect(posts('/sos')).toHaveLength(1);
  });

  it('says the SOS was not delivered with no connection, sends nothing and offers to dial emergency services', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    view();
    fireEvent.change(screen.getByLabelText('הודעה קצרה (אופציונלי)'), { target: { value: 'עזרה' } });
    hold(SOS_HOLD_MS);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ה-SOS לא נמסר');
    expect(alert).toHaveTextContent(/אין חיבור/);
    expect(posts('/sos')).toHaveLength(0);
    expect(screen.getByLabelText('הודעה קצרה (אופציונלי)')).toHaveValue('עזרה');
    fireEvent.click(screen.getByRole('button', { name: /חירום 112/ }));
    expect(open).toHaveBeenCalledWith('tel:112');
  });

  it('sends on the next hold once the connection is back and the not-delivered card goes away', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    view();
    hold(SOS_HOLD_MS);
    expect(await screen.findByText('ה-SOS לא נמסר')).toBeInTheDocument();
    fireEvent.mouseUp(sosButton());
    network.state = { isConnected: true, isInternetReachable: true };
    hold(SOS_HOLD_MS);
    await waitFor(() => expect(screen.getByLabelText('SOS פעיל')).toBeInTheDocument());
    expect(posts('/sos')).toHaveLength(1);
    expect(screen.queryByText('ה-SOS לא נמסר')).toBeNull();
  });

  it('shows an error and keeps the message when sending fails, and sends again on the next hold', async () => {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) =>
      String(url).endsWith('/sos') && init?.method === 'POST'
        ? json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)
        : json([]),
    );
    view();
    fireEvent.change(screen.getByLabelText('הודעה קצרה (אופציונלי)'), { target: { value: 'עזרה' } });
    hold(SOS_HOLD_MS);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('ה-SOS לא נמסר');
    expect(alert).toHaveTextContent(/השרת/);
    expect(screen.getByRole('button', { name: /חירום 112/ })).toBeInTheDocument();
    expect(screen.getByLabelText('הודעה קצרה (אופציונלי)')).toHaveValue('עזרה');
    expect(screen.queryByLabelText('SOS פעיל')).toBeNull();
    fireEvent.mouseUp(sosButton());
    hold(SOS_HOLD_MS);
    await waitFor(() => expect(posts('/sos')).toHaveLength(2));
  });

  it('limits the message to the allowed length', () => {
    view();
    expect(screen.getByLabelText('הודעה קצרה (אופציונלי)')).toHaveAttribute('maxlength', '500');
  });
});

describe('SosScreen active state', () => {
  it('shows the active SOS the searcher already has when the screen opens', async () => {
    existing = [makeSos({ message: 'פגיעה בקרסול' })];
    view();
    expect(await screen.findByLabelText('SOS פעיל')).toBeInTheDocument();
    expect(screen.getByText('פגיעה בקרסול')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /הפעל SOS/ })).toBeNull();
  });

  it('ignores an SOS sent to the searcher by someone else', async () => {
    existing = [makeSos({ sender: { ...makeSos().sender, participantId: '00000000-0000-4000-8000-0000000000ff' } })];
    view();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sosButton()).toBeInTheDocument();
  });

  it('closes the SOS only after a confirmation and returns to activation', async () => {
    existing = [makeSos()];
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) =>
      String(url).endsWith('/close')
        ? json(closedBySelf)
        : String(url).endsWith('/sos') && init?.method !== 'POST'
          ? json(existing)
          : json([]),
    );
    const closedBySelf = makeSos({
      status: 'closed',
      closedAt: '2026-10-03T17:10:00.000Z',
      closedBy: { role: 'searcher', name: 'דנה כהן' },
    });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'בטל SOS…' }));
    expect(posts('/close')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'השאר פעיל' }));
    expect(screen.getByRole('button', { name: 'בטל SOS…' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'בטל SOS…' }));
    fireEvent.click(screen.getByRole('button', { name: 'כן, סגור את ה-SOS' }));
    expect(await screen.findByRole('button', { name: /הפעל SOS/ })).toBeInTheDocument();
    expect(posts('/close')).toHaveLength(1);
    expect(screen.getByText(/נסגר על ידך/)).toBeInTheDocument();
  });

  it('keeps the SOS active and says so when closing fails', async () => {
    existing = [makeSos()];
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) =>
      String(url).endsWith('/close')
        ? json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)
        : String(url).endsWith('/sos') && init?.method !== 'POST'
          ? json(existing)
          : json([]),
    );
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'בטל SOS…' }));
    fireEvent.click(screen.getByRole('button', { name: 'כן, סגור את ה-SOS' }));
    expect(await screen.findByText(/הסגירה לא הצליחה/)).toBeInTheDocument();
    expect(screen.getByLabelText('SOS פעיל')).toBeInTheDocument();
  });

  it('returns to activation with a note when the commander closes it (realtime)', async () => {
    existing = [makeSos()];
    view();
    await screen.findByLabelText('SOS פעיל');
    act(() => client.setQueryData(missionKeys.sos(MISSION_ID), [closedByCommander]));
    expect(await screen.findByText(/נסגר על ידי המנהל/)).toBeInTheDocument();
    expect(sosButton()).toBeInTheDocument();
  });
});
