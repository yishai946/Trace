import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadFixes } from '.';
import { useSession } from '../../state/session';

const missionId = '00000000-0000-4000-8000-000000000001';
const participation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned' as const,
  polygonId: '00000000-0000-4000-8000-0000000000a1',
  taskStatus: 'searching' as const,
};
const fix = { coords: { latitude: 31.78, longitude: 35.13, accuracy: 5 }, timestamp: Date.UTC(2026, 9, 3, 10, 1) };
const ok = () =>
  new Response(JSON.stringify({ stored: 1, duplicates: 0 }), { headers: { 'content-type': 'application/json' } });

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId, participation }));
afterEach(() => vi.unstubAllGlobals());

describe('uploadFixes', () => {
  it('sends the batch to the mission with the session token, marked by the task', async () => {
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    await uploadFixes([fix]);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${missionId}/track-points`,
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer t1', 'content-type': 'application/json' },
        body: JSON.stringify({
          points: [
            { position: [35.13, 31.78], recordedAt: '2026-10-03T10:01:00.000Z', accuracy: 5, context: 'search' },
          ],
        }),
      }),
    );
  });

  it('sends nothing without a mission or a session, after the activity ended, or for an empty batch', async () => {
    const fetch = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetch);
    await uploadFixes([]);
    useSession.setState({ participation: { ...participation, status: 'ended' } });
    await uploadFixes([fix]);
    useSession.setState({ missionId: null });
    await uploadFixes([fix]);
    useSession.setState({ missionId, participation, token: null });
    await uploadFixes([fix]);

    expect(fetch).not.toHaveBeenCalled();
  });
});
