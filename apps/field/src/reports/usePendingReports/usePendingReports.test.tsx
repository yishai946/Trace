import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePendingReports } from '.';
import { enqueue, flushOutbox } from '../../outbox';

const missionId = '00000000-0000-4000-8000-000000000001';
const report = (id: string, type: string) => ({
  id,
  type,
  text: 'ראיתי',
  position: { type: 'Point', coordinates: [35.13, 31.78] },
  accuracy: null,
  reportedAt: '2026-10-03T10:01:00.000Z',
});
const ID_1 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a81';
const ID_2 = '0190a3b2-7c4e-7a10-8a5e-3f2d1c0b9a82';

describe('usePendingReports', () => {
  it('counts the reports that wait and tells whether one says the missing person was located', async () => {
    const { result } = renderHook(() => usePendingReports(missionId));
    await waitFor(() => expect(result.current).toEqual({ count: 0, located: false }));

    await act(() => enqueue({ kind: 'report', missionId, payloads: [report(ID_1, 'hazard')], ids: [ID_1] }));
    await waitFor(() => expect(result.current).toEqual({ count: 1, located: false }));

    await act(() => enqueue({ kind: 'report', missionId, payloads: [report(ID_2, 'located')], ids: [ID_2] }));
    await waitFor(() => expect(result.current).toEqual({ count: 2, located: true }));
  });

  it('updates after a send, and ignores other missions and photos', async () => {
    await enqueue({ kind: 'report', missionId: 'other', payloads: [report(ID_1, 'located')], ids: [ID_1] });
    await enqueue({ kind: 'report-photo', missionId, payloads: [{}] });
    await enqueue({ kind: 'report', missionId, payloads: [report(ID_2, 'located')], ids: [ID_2] });
    const { result } = renderHook(() => usePendingReports(missionId));
    await waitFor(() => expect(result.current).toEqual({ count: 1, located: true }));

    await act(() => flushOutbox({ report: { batchSize: 1, send: async () => 'sent' } }));
    await waitFor(() => expect(result.current).toEqual({ count: 0, located: false }));
  });

  it('has nothing without a mission', async () => {
    const { result } = renderHook(() => usePendingReports(null));
    expect(result.current).toEqual({ count: 0, located: false });
  });
});
