import { QueryClient } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagesScreen } from '.';
import { missionKeys } from '../../mission/queries';
import { makeCritical, makeMessage, makeMissionOf } from '../../messages/fixtures';
import { MISSION_ID } from '../../reports/fixtures';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let client: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;

function show(answer: () => Response | Promise<Response>) {
  fetchMock = vi.fn(async () => answer());
  vi.stubGlobal('fetch', fetchMock);
  return render(
    <TestProviders client={client}>
      <MessagesScreen />
    </TestProviders>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true, missionId: MISSION_ID });
});
afterEach(() => vi.unstubAllGlobals());

describe('MessagesScreen', () => {
  it('says it is loading', () => {
    show(() => new Promise(() => undefined));
    expect(screen.getByRole('status')).toHaveTextContent('טוען הודעות…');
  });

  it('says there are no messages yet', async () => {
    show(() => json([]));
    expect(await screen.findByText('עדיין לא התקבלו הודעות מהמנהל')).toBeInTheDocument();
  });

  it('lists the messages, counts the new ones, and explains that they are one way', async () => {
    show(() =>
      json([makeCritical(), makeMessage(), makeMessage({ status: 'read', readAt: '2026-10-03T16:30:00.000Z' })]),
    );
    expect(await screen.findByText('2 חדשות')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^הודעה /)).toHaveLength(3);
    expect(screen.getByText(/ללא מענה בצ'אט/)).toBeInTheDocument();
  });

  it('says it could not load and tries again on request', async () => {
    let ok = false;
    show(() => (ok ? json([makeMessage()]) : json({ error: { code: 'INTERNAL', message: 'x' } }, 500)));
    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לטעון את ההודעות');
    ok = true;
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByLabelText('הודעה רגילה')).toBeInTheDocument();
  });

  it('keeps the messages it has when a refresh fails', async () => {
    client.setQueryData(missionKeys.messages(MISSION_ID), [makeMessage()]);
    show(() => json({ error: { code: 'INTERNAL', message: 'x' } }, 500));
    expect(await screen.findByLabelText('הודעה רגילה')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('shows a message that arrived over the connection', async () => {
    show(() => json([]));
    await screen.findByText('עדיין לא התקבלו הודעות מהמנהל');
    client.setQueryData(missionKeys.messages(MISSION_ID), [makeMessage({ body: 'חוזרים לחניון' })]);
    expect(await screen.findByText('חוזרים לחניון')).toBeInTheDocument();
  });

  describe('call the commander', () => {
    it('dials the commander from the footer', async () => {
      const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      client.setQueryData(missionKeys.mission(MISSION_ID), makeMissionOf('+972501234567'));
      show(() => json([makeMessage()]));
      fireEvent.click(await screen.findByRole('button', { name: 'התקשר למנהל' }));
      expect(open).toHaveBeenCalledWith('tel:+972501234567');
    });

    it('offers no call when the commander has no phone', async () => {
      client.setQueryData(missionKeys.mission(MISSION_ID), makeMissionOf(null));
      show(() => json([makeMessage()]));
      await screen.findByLabelText('הודעה רגילה');
      expect(screen.queryByRole('button', { name: 'התקשר למנהל' })).not.toBeInTheDocument();
    });

    it('says the call did not open and keeps the messages', async () => {
      vi.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialer'));
      client.setQueryData(missionKeys.mission(MISSION_ID), makeMissionOf('+972501234567'));
      show(() => json([makeMessage()]));
      fireEvent.click(await screen.findByRole('button', { name: 'התקשר למנהל' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לפתוח את החייגן');
      expect(screen.getByLabelText('הודעה רגילה')).toBeInTheDocument();
    });
  });
});
