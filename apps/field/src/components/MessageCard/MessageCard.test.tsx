import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageCard } from '.';
import { missionKeys } from '../../mission/queries';
import { makeCritical, makeMessage } from '../../messages/fixtures';
import { MISSION_ID } from '../../reports/fixtures';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
const bodies = () => fetchMock.mock.calls.map(([, init]) => init?.body);

function show(message: ReturnType<typeof makeMessage>, answer: () => Response = () => json(message)) {
  client.setQueryData(missionKeys.messages(MISSION_ID), [message]);
  fetchMock = vi.fn(async () => answer());
  vi.stubGlobal('fetch', fetchMock);
  return render(
    <TestProviders client={client}>
      <MessageCard message={message} />
    </TestProviders>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true, missionId: MISSION_ID });
});
afterEach(() => {
  vi.unstubAllGlobals();
  usePreferences.setState(usePreferences.getInitialState());
});

describe('MessageCard', () => {
  it('opens an unread normal message and reports it read', async () => {
    const message = makeMessage();
    show(message, () => json({ ...message, status: 'read', readAt: '2026-10-03T17:00:00.000Z' }));
    expect(screen.getByText('חדשה')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'פתח הודעה רגילה' }));
    await waitFor(() => expect(bodies()).toEqual([JSON.stringify({ receipt: 'read' })]));
  });

  it('ignores a second tap while the first report is on its way', async () => {
    show(makeMessage());
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const open = screen.getByRole('button', { name: 'פתח הודעה רגילה' });
    fireEvent.click(open);
    await act(async () => undefined);
    fireEvent.click(open);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('has no "אישרתי" on a normal or important message', () => {
    show(makeMessage({ urgency: 'important' }));
    expect(screen.queryByRole('button', { name: 'אישרתי' })).toBeNull();
    expect(screen.getByText('חשובה')).toBeInTheDocument();
  });

  it('a read normal message shows when it was read and cannot be opened again', () => {
    show(makeMessage({ status: 'read', readAt: '2026-10-03T17:00:00.000Z' }));
    expect(screen.getByText(/נקראה/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /פתח הודעה/ })).toBeNull();
  });

  it('shows "אישרתי" on a critical message and reports it acknowledged', async () => {
    const message = makeCritical();
    show(message, () => json({ ...message, status: 'acknowledged', acknowledgedAt: '2026-10-03T17:00:00.000Z' }));
    expect(screen.getByText('קריטית')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'אישרתי' }));
    await waitFor(() => expect(bodies()).toEqual([JSON.stringify({ receipt: 'acknowledged' })]));
  });

  it('a critical message already acknowledged has no button and says so', () => {
    show(
      makeCritical({
        status: 'acknowledged',
        readAt: '2026-10-03T17:00:00.000Z',
        acknowledgedAt: '2026-10-03T17:01:00.000Z',
      }),
    );
    expect(screen.queryByRole('button', { name: 'אישרתי' })).toBeNull();
    expect(screen.getByText(/אושרה/)).toBeInTheDocument();
  });

  it('opening a critical message reports it read, and the button stays until it is acknowledged', async () => {
    const message = makeCritical();
    show(message, () => json({ ...message, status: 'read', readAt: '2026-10-03T17:00:00.000Z' }));
    fireEvent.click(screen.getByRole('button', { name: 'פתח הודעה קריטית' }));
    await waitFor(() => expect(bodies()).toEqual([JSON.stringify({ receipt: 'read' })]));
    expect(screen.getByRole('button', { name: 'אישרתי' })).toBeInTheDocument();
  });

  it('says the acknowledgement did not reach the commander and lets the searcher try again', async () => {
    show(makeCritical(), () => json({ error: { code: 'INTERNAL', message: 'x' } }, 500));
    fireEvent.click(screen.getByRole('button', { name: 'אישרתי' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('האישור לא נשלח');
    expect(screen.getByRole('button', { name: 'אישרתי' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('does not tell the searcher when reading a message failed, and tries again on the next open', async () => {
    show(makeMessage(), () => json({ error: { code: 'INTERNAL', message: 'x' } }, 500));
    fireEvent.click(screen.getByRole('button', { name: 'פתח הודעה רגילה' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'פתח הודעה רגילה' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('MessageCard urgency styles', () => {
  it.each(['night', 'day'] as const)('tells the three levels apart in %s', (themeId) => {
    usePreferences.setState({ themePreference: themeId });
    const borders = (['normal', 'important', 'critical'] as const).map((urgency) => {
      const { unmount } = show(makeMessage({ urgency, status: 'read' }));
      const card = screen.getByLabelText(/^הודעה /);
      const style = getComputedStyle(card);
      unmount();
      return `${style.borderTopColor} ${style.borderTopWidth}`;
    });
    expect(new Set(borders).size).toBe(3);
    expect(borders[1]).toContain('2px');
    expect(borders[2]).toContain('2px');
  });
});
