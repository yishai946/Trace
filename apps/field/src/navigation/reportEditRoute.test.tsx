import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportEditScreen from '../app/report-edit';
import { missionKeys } from '../mission/queries';
import { assigned, makeReport, MISSION_ID } from '../reports/fixtures';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), canGoBack: () => true }));
const params = vi.hoisted(() => ({ id: undefined as string | undefined }));
vi.mock('expo-router', () => ({
  useRouter: () => router,
  useLocalSearchParams: () => params,
  Redirect: ({ href }: { href: string }) => <p>{`redirect ${href}`}</p>,
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <TestProviders client={client}>{children}</TestProviders>;
const mine = makeReport({
  text: 'הדיווח שלי',
  reportedBy: { role: 'searcher', name: 'דנה', callsign: assigned.callsign },
});

beforeEach(() => {
  router.back.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  params.id = mine.id;
  useSession.setState({
    ...useSession.getInitialState(),
    restored: true,
    token: 'tok',
    missionId: MISSION_ID,
    participation: assigned,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the report edit route', () => {
  it('goes back to the map when the searcher is in no mission', () => {
    useSession.setState({ missionId: null });
    render(<ReportEditScreen />, { wrapper });
    expect(screen.getByText('redirect /map')).toBeInTheDocument();
  });

  it('opens the form on the report from the list', async () => {
    client.setQueryData(missionKeys.reports(MISSION_ID), [mine]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([mine])),
    );
    render(<ReportEditScreen />, { wrapper });
    expect(await screen.findByRole('textbox', { name: 'פירוט' })).toHaveValue('הדיווח שלי');
  });

  it('says it is loading, then that the report is gone, with a way back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([])),
    );
    render(<ReportEditScreen />, { wrapper });
    expect(screen.getByText('טוען דיווח…')).toBeInTheDocument();
    expect(await screen.findByText('הדיווח כבר לא קיים.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'חזרה' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('does not open a report of another searcher', async () => {
    const theirs = makeReport({ text: 'של חבר' });
    params.id = theirs.id;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json([theirs, mine])),
    );
    render(<ReportEditScreen />, { wrapper });
    expect(await screen.findByText('אפשר לערוך רק דיווח שאתה שלחת.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'פירוט' })).toBeNull();
  });

  it('offers a retry when the reports cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500)),
    );
    render(<ReportEditScreen />, { wrapper });
    expect(await screen.findByText('לא ניתן לטעון את הדיווח')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'נסה שוב' })).toBeInTheDocument();
  });
});
