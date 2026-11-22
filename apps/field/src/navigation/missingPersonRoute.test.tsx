import type { Mission } from '@trace/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MissingPersonScreen from '../app/missing-person';
import { missionKeys } from '../mission/queries';
import { applyEvent } from '../realtime';
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

  it('shows details the commander changed meanwhile, without a refresh (UC-C03)', async () => {
    const mission: Mission = {
      id: missionId,
      name: 'מסע 0412',
      status: 'active',
      joinCode: 'K7-4Q2',
      missingPerson: {
        name: 'נועם אברהם',
        age: 74,
        disappearedAt: null,
        description: 'מעיל חום',
        additionalInfo: null,
        photoUrl: null,
      },
      rallyPoint: { type: 'Point', coordinates: [35.13, 31.78] },
      lkp: null,
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
    };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    // The cache was filled by joining the mission, so it is fresh and nothing is fetched.
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(missionKeys.mission(missionId), mission);
    render(<MissingPersonScreen />, {
      wrapper: ({ children }) => <TestProviders client={client}>{children}</TestProviders>,
    });
    expect(screen.getByText('מעיל חום')).toBeInTheDocument();

    const description = 'מעיל חום, כובע צמר אפור';
    act(() =>
      applyEvent(client, {
        type: 'mission.updated',
        missionId,
        mission: { ...mission, missingPerson: { ...mission.missingPerson, description } },
      }),
    );
    expect(await screen.findByText(description)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
