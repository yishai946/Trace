import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportPhotoSender, reportSender } from '.';
import type { OutboxItem } from '../../outbox';
import { useSession } from '../../state/session';

const missionId = '00000000-0000-4000-8000-000000000001';
const reportId = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a87';
const payload = {
  id: reportId,
  type: 'hazard',
  text: 'מדרון חלק',
  position: { type: 'Point', coordinates: [35.13, 31.78] },
  accuracy: 5,
  reportedAt: '2026-10-03T10:01:00.000Z',
};
const saved = {
  ...payload,
  missionId,
  polygonId: null,
  status: 'new',
  reportedBy: { role: 'searcher', name: 'דנה', callsign: 4 },
  hasPhoto: false,
  photoUrl: null,
  createdAt: '2026-10-03T10:02:00.000Z',
};
const item = (kind: OutboxItem['kind'], body: unknown): OutboxItem => ({
  id: reportId,
  kind,
  missionId,
  payload: body,
  createdAt: 0,
});
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const failure = (status: number, code: string) => json(status, { error: { code, message: 'x' } });
const stubFetch = (response: Response | Error) => {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

beforeEach(() => useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId }));
afterEach(() => vi.unstubAllGlobals());

describe('reportSender', () => {
  it('posts one report to the mission and is done on 201 and on 200', async () => {
    for (const status of [201, 200]) {
      const fetch = stubFetch(json(status, saved));
      await expect(reportSender.send(missionId, [item('report', payload)])).resolves.toBe('sent');
      expect(fetch).toHaveBeenCalledWith(
        `https://api.test/api/missions/${missionId}/reports`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
      );
    }
    expect(reportSender.batchSize).toBe(1);
  });

  it('drops the report the server will never take', async () => {
    stubFetch(failure(400, 'VALIDATION_ERROR'));
    await expect(reportSender.send(missionId, [item('report', payload)])).resolves.toBe('drop-batch');
    stubFetch(failure(409, 'REPORT_ID_TAKEN'));
    await expect(reportSender.send(missionId, [item('report', payload)])).resolves.toBe('drop-batch');
  });

  it.each([
    [409, 'MISSION_ENDED'],
    [409, 'PARTICIPATION_ENDED'],
    [404, 'NOT_FOUND'],
    [403, 'FORBIDDEN'],
  ] as const)('drops the mission reports on %s %s', async (status, code) => {
    stubFetch(failure(status, code));
    await expect(reportSender.send(missionId, [item('report', payload)])).resolves.toBe('drop-mission');
  });

  it('keeps the report on a network error, a server error and a missing token', async () => {
    stubFetch(new TypeError('offline'));
    await expect(reportSender.send(missionId, [item('report', payload)])).rejects.toThrow();
    stubFetch(failure(500, 'INTERNAL_ERROR'));
    await expect(reportSender.send(missionId, [item('report', payload)])).rejects.toThrow();
    useSession.setState({ token: null });
    const fetch = stubFetch(json(201, saved));
    await expect(reportSender.send(missionId, [item('report', payload)])).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an invalid payload without calling the server', async () => {
    const fetch = stubFetch(json(201, saved));
    await expect(reportSender.send(missionId, [item('report', { ...payload, type: 'rumor' })])).resolves.toBe(
      'drop-batch',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('reportPhotoSender', () => {
  const photo = { reportId, base64: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0)) };

  it('puts the decoded JPEG bytes on the report', async () => {
    const fetch = stubFetch(json(200, { ...saved, hasPhoto: true, photoUrl: '/photo' }));
    await expect(reportPhotoSender.send(missionId, [item('report-photo', photo)])).resolves.toBe('sent');

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/missions/${missionId}/reports/${reportId}/photo`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({ 'content-type': 'image/jpeg', authorization: 'Bearer t1' });
    expect(Array.from(init.body as Uint8Array)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(reportPhotoSender.batchSize).toBe(1);
  });

  it.each([400, 403, 404, 409, 413, 415])('drops only this photo on %s', async (status) => {
    stubFetch(failure(status, 'NOT_FOUND'));
    await expect(reportPhotoSender.send(missionId, [item('report-photo', photo)])).resolves.toBe('drop-batch');
  });

  it('keeps the photo on a network error and on a server error', async () => {
    stubFetch(new TypeError('offline'));
    await expect(reportPhotoSender.send(missionId, [item('report-photo', photo)])).rejects.toThrow();
    stubFetch(failure(500, 'INTERNAL_ERROR'));
    await expect(reportPhotoSender.send(missionId, [item('report-photo', photo)])).rejects.toThrow();
  });

  it('drops an invalid payload without calling the server', async () => {
    const fetch = stubFetch(json(200, saved));
    await expect(reportPhotoSender.send(missionId, [item('report-photo', { reportId: 'x' })])).resolves.toBe(
      'drop-batch',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
