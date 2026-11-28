import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mission, participants, polygonA } from '../../mission/fixtures';
import { useSearcherPanel } from './useSearcherPanel';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const finished = participants.map((p) => ({ ...p, status: 'ended' as const }));
const searcherId = finished[0]?.id ?? '';

afterEach(() => vi.unstubAllGlobals());

describe('useSearcherPanel', () => {
  it('does not show a searcher who ended while the mission is live', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderHook(
      () => useSearcherPanel({ missionId: mission.id, searcherId, participants: finished, polygons: [polygonA] }),
      { wrapper },
    );
    expect(result.current.searcher).toBeNull();
  });

  it('shows their route once the mission ended (UC-C20)', async () => {
    const points = [
      { position: [35.1, 31.7], recordedAt: '2026-11-08T06:10:00Z', accuracy: null, context: 'search' },
      { position: [35.2, 31.8], recordedAt: '2026-11-08T06:11:00Z', accuracy: null, context: 'search' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ participantId: searcherId, points }))),
    );
    const { result } = renderHook(
      () =>
        useSearcherPanel({
          missionId: mission.id,
          searcherId,
          participants: finished,
          polygons: [polygonA],
          missionEnded: true,
        }),
      { wrapper },
    );
    expect(result.current.searcher?.id).toBe(searcherId);
    await waitFor(() => expect(result.current.route?.positions).toHaveLength(2));
  });
});
