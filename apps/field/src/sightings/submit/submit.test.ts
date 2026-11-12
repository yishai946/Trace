import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitSighting } from '.';
import { pending } from '../../outbox';
import { useSession } from '../../state/session';

const network = vi.hoisted(() => ({ state: { isConnected: true, isInternetReachable: true } }));
vi.mock('expo-network', () => ({
  getNetworkStateAsync: async () => network.state,
  addNetworkStateListener: vi.fn(),
}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
vi.mock('expo-location', () => ({ Accuracy: { High: 4 } }));
vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));

const missionId = '00000000-0000-4000-8000-000000000001';
const sighting = {
  id: '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d',
  position: { type: 'Point' as const, coordinates: [35.0139, 31.7412] as [number, number] },
  observedAt: '2026-10-03T13:58:00.000Z',
  source: 'self' as const,
  description: null,
};
const saved = {
  ...sighting,
  missionId,
  number: 1,
  reportedBy: { role: 'searcher', name: 'אלון', callsign: 7 },
  lkpDecision: null,
  lkpCandidate: true,
  createdAt: '2026-10-03T14:00:00.000Z',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  network.state = { isConnected: true, isInternetReachable: true };
  useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId });
});
afterEach(() => vi.unstubAllGlobals());

describe('submitSighting', () => {
  it('keeps the sighting and does not send it while offline', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(submitSighting({ missionId, sighting })).resolves.toBe('pending');
    expect(fetch).not.toHaveBeenCalled();
    expect(await pending()).toHaveLength(1);
  });

  it('sends it at once when online', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(201, saved)),
    );
    await expect(submitSighting({ missionId, sighting })).resolves.toBe('sent');
    expect(await pending()).toEqual([]);
  });

  it('keeps it when the send fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(submitSighting({ missionId, sighting })).resolves.toBe('pending');
    expect(await pending()).toHaveLength(1);
  });

  it('reports a refusal for good and drops it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { error: { code: 'MISSION_ENDED', message: 'x' } })),
    );
    await expect(submitSighting({ missionId, sighting })).resolves.toBe('rejected');
    expect(await pending()).toEqual([]);
  });
});
