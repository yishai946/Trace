import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRejectedReports } from '.';
import { enqueue, flushOutbox } from '../../outbox';

const MISSION = 'mission-a';

async function dropReport(id: string) {
  await enqueue({ kind: 'report', missionId: MISSION, payloads: [{ id }], ids: [id] });
  await flushOutbox({ report: { batchSize: 10, send: async () => 'drop-batch' } });
}

describe('useRejectedReports', () => {
  it('counts the reports the server refused after they waited on the phone, until they are acknowledged', async () => {
    const { result } = renderHook(() => useRejectedReports());
    expect(result.current.count).toBe(0);

    await act(async () => dropReport('rejected-1'));
    await waitFor(() => expect(result.current.count).toBe(1));

    act(() => result.current.acknowledge());
    await waitFor(() => expect(result.current.count).toBe(0));
  });

  it('ignores other kinds of items', async () => {
    const { result } = renderHook(() => useRejectedReports());
    await act(async () => {
      await enqueue({ kind: 'sighting', missionId: MISSION, payloads: [1], ids: ['s-1'] });
      await flushOutbox({ sighting: { batchSize: 10, send: async () => 'drop-batch' } });
    });
    expect(result.current.count).toBe(0);
  });
});
