import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sightingSender } from '.';
import type { OutboxItem } from '../../outbox';
import { useSession } from '../../state/session';

const missionId = '00000000-0000-4000-8000-000000000001';
const id = '0192f3a0-7b2e-7c3a-9d41-5e6f7a8b9c0d';
const queued = {
  id,
  position: { type: 'Point', coordinates: [35.0139, 31.7412] },
  observedAt: '2026-10-03T13:58:00.000Z',
  source: 'self',
  description: null,
};
const saved = {
  id,
  missionId,
  number: 1,
  position: queued.position,
  observedAt: queued.observedAt,
  description: null,
  source: 'self',
  reportedBy: { role: 'searcher', name: 'אלון', callsign: 7 },
  lkpDecision: null,
  lkpCandidate: true,
  createdAt: '2026-10-03T14:00:00.000Z',
};
const item = (payload: unknown): OutboxItem => ({ id, kind: 'sighting', missionId, payload, createdAt: 0 });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const failure = (status: number, code: string) => json(status, { error: { code, message: 'x' } });

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId }));
afterEach(() => vi.unstubAllGlobals());

describe('sightingSender', () => {
  it('sends one sighting with its id and the session token, a blank description as null', async () => {
    const fetch = vi.fn(async () => json(201, saved));
    vi.stubGlobal('fetch', fetch);

    expect(sightingSender.batchSize).toBe(1);
    await expect(sightingSender.send(missionId, [item({ ...queued, description: '   ' })])).resolves.toBe('sent');
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/api/missions/${missionId}/sightings`,
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer t1', 'content-type': 'application/json' },
        body: JSON.stringify(queued),
      }),
    );
  });

  it('counts a sighting the server already had as sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, saved)),
    );
    await expect(sightingSender.send(missionId, [item(queued)])).resolves.toBe('sent');
  });

  it('drops the batch, without a request, when the stored sighting is not valid', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(sightingSender.send(missionId, [item({ ...queued, source: 'certain' })])).resolves.toBe('drop-batch');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'VALIDATION_ERROR'],
    [409, 'SIGHTING_ID_TAKEN'],
  ])('drops only the sighting on %i %s', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failure(status, code)),
    );
    await expect(sightingSender.send(missionId, [item(queued)])).resolves.toBe('drop-batch');
  });

  it.each([
    [409, 'PARTICIPATION_ENDED'],
    [409, 'MISSION_ENDED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ])('drops the mission’s sightings on %i %s', async (status, code) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failure(status, code)),
    );
    await expect(sightingSender.send(missionId, [item(queued)])).resolves.toBe('drop-mission');
  });

  it.each([
    ['the network is down', () => Promise.reject(new TypeError('Network request failed'))],
    ['the server fails', async () => failure(500, 'INTERNAL_ERROR')],
    ['the session expired', async () => failure(401, 'UNAUTHENTICATED')],
  ])('keeps the sighting when %s', async (_name, respond) => {
    vi.stubGlobal('fetch', vi.fn(respond));
    await expect(sightingSender.send(missionId, [item(queued)])).rejects.toBeDefined();
  });

  it('keeps the sighting while there is no token, without a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    useSession.setState({ token: null });
    await expect(sightingSender.send(missionId, [item(queued)])).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
