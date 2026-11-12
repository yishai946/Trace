import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissingPersonScreen from '../app/missing-person';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  Redirect: ({ href }: { href: string }) => <p>{`redirect ${href}`}</p>,
}));

const missionId = '00000000-0000-4000-8000-000000000001';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true, missionId }));
afterEach(() => vi.unstubAllGlobals());

describe('the missing person route', () => {
  it('goes back to the map when the searcher is in no mission', () => {
    useSession.setState({ missionId: null });
    render(<MissingPersonScreen />, { wrapper: TestProviders });
    expect(screen.getByText('redirect /map')).toBeInTheDocument();
  });

  it('offers a retry when the mission cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500, { error: { code: 'INTERNAL_ERROR', message: 'x' } })));
    render(<MissingPersonScreen />, { wrapper: TestProviders });

    expect(await screen.findByRole('button', { name: 'נסה שוב' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'סגור' })).toBeInTheDocument();
  });
});
