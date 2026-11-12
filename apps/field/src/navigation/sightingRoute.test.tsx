import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SightingScreen from '../app/sighting';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

vi.mock('expo-router', () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  Redirect: ({ href }: { href: string }) => <p>{`redirect ${href}`}</p>,
}));
vi.mock('../location/useCurrentFix', () => ({ useCurrentFix: () => ({ state: 'locating', fix: null }) }));
vi.mock('../sightings/submit', () => ({ submitSighting: vi.fn() }));

const missionId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  useSession.setState({ ...useSession.getInitialState(), token: 't1', restored: true, missionId });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'x' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('the sighting route', () => {
  it('goes back to the map when the searcher is in no mission', () => {
    useSession.setState({ missionId: null });
    render(<SightingScreen />, { wrapper: TestProviders });
    expect(screen.getByText('redirect /map')).toBeInTheDocument();
  });

  it('opens the form in a mission', () => {
    render(<SightingScreen />, { wrapper: TestProviders });
    expect(screen.getByRole('heading', { name: 'תצפית על הנעדר' })).toBeInTheDocument();
  });
});
