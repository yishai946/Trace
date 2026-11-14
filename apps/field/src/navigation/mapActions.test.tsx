import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapScreen from '../app/(mission)/map';
import type { MissionArea } from '../mission/missionArea';
import { assigned, makeReport, MISSION_ID, POLYGON_B } from '../reports/fixtures';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
const mapProps = vi.hoisted(() => ({ last: null as null | { area: MissionArea } }));
vi.mock('../components/MissionMap', () => ({
  MissionMap: (props: { area: MissionArea }) => {
    mapProps.last = props;
    return <div role="img" aria-label="מפת המסע" />;
  },
}));

beforeEach(() => {
  router.push.mockClear();
  useSession.setState({
    ...useSession.getInitialState(),
    restored: true,
    missionId: '00000000-0000-4000-8000-000000000001',
    participation: {
      id: '00000000-0000-4000-8000-000000000002',
      callsign: 7,
      status: 'assigned',
      polygonId: '00000000-0000-4000-8000-0000000000a1',
      taskStatus: 'ready',
    },
  });
});

describe('the map sheet actions', () => {
  it('opens the sighting form with "תצפית"', () => {
    render(<MapScreen />, { wrapper: TestProviders });
    fireEvent.click(screen.getByRole('button', { name: 'תצפית' }));
    expect(router.push).toHaveBeenCalledWith('/sighting', { dangerouslySingular: true });
  });

  describe('the reports of the polygon (UC-F11)', () => {
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const polygon = {
      id: assigned.polygonId,
      missionId: MISSION_ID,
      name: 'A',
      status: 'active',
      coverage: 0,
      activeSearchers: 1,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [35, 31.7],
            [35.01, 31.7],
            [35.01, 31.71],
            [35, 31.7],
          ],
        ],
      },
      createdAt: '2026-11-06T10:00:00.000Z',
      updatedAt: '2026-11-06T10:00:00.000Z',
    };
    const serve = (reports: unknown[]) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.endsWith('/reports') ? json(reports) : json(url.endsWith('/polygons') ? [polygon] : {}),
        ),
      );
    const show = () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <TestProviders client={client}>{children}</TestProviders>
      );
      return render(<MapScreen />, { wrapper });
    };
    beforeEach(() => useSession.setState({ token: 'tok' }));
    afterEach(() => vi.unstubAllGlobals());

    it('opens the reports of the polygon with "דיווחים בפוליגון"', () => {
      serve([]);
      show();
      fireEvent.click(screen.getByRole('button', { name: /דיווחים בפוליגון/ }));
      expect(router.push).toHaveBeenCalledWith('/reports', { dangerouslySingular: true });
    });

    it('counts the reports of the polygon on the button and draws them on the map', async () => {
      serve([makeReport(), makeReport({ type: 'general' }), makeReport({ polygonId: POLYGON_B })]);
      show();
      expect(await screen.findByRole('button', { name: 'דיווחים בפוליגון, 2' })).toBeInTheDocument();
      expect(mapProps.last?.area.data.reports).toHaveLength(2);
    });

    it.each(['ready', 'searching', 'paused'] as const)(
      'floats over the map, never inside the sheet, while the task is %s',
      (taskStatus) => {
        useSession.setState({ participation: { ...assigned, taskStatus } });
        serve([]);
        show();
        const button = screen.getByRole('button', { name: /דיווחים בפוליגון/ });
        // The map area ends where the sheet begins, whatever the sheet's height, so the sheet cannot cover the button.
        expect(within(screen.getByTestId('map-area')).getByRole('button', { name: /דיווחים בפוליגון/ })).toBe(button);
        expect(within(screen.getByTestId('map-sheet')).queryByRole('button', { name: /דיווחים בפוליגון/ })).toBeNull();
      },
    );

    it('is not offered to a searcher without a polygon', () => {
      useSession.setState({ participation: { ...assigned, status: 'available', polygonId: null, taskStatus: null } });
      serve([]);
      show();
      expect(screen.queryByRole('button', { name: /דיווחים בפוליגון/ })).toBeNull();
    });
  });
});
