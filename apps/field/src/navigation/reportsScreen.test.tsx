import type { MissionArea } from '../mission/missionArea';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsScreen from '../app/(mission)/reports';
import { missionKeys } from '../mission/queries';
import { applyEvent } from '../realtime';
import { assigned, makeReport, MISSION_ID, POLYGON_A, POLYGON_B } from '../reports/fixtures';
import { enqueue } from '../outbox';
import { useSession } from '../state/session';
import { TestProviders } from '../test/providers';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false }),
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));
const mapProps = vi.hoisted(() => ({
  last: null as null | { area: MissionArea; onPressReport?: (id: string) => void },
}));
vi.mock('../components/MissionMap', () => ({
  MissionMap: (props: { area: MissionArea; onPressReport?: (id: string) => void; accessibilityLabel?: string }) => {
    mapProps.last = props;
    return <div role="img" aria-label={props.accessibilityLabel ?? 'מפת המסע'} />;
  },
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const polygon = (id: string, name: string) => ({
  id,
  missionId: MISSION_ID,
  name,
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
});

/** The server: the reports it lists now, and a polygon A and B. */
const server = { reports: [] as unknown[], reportsStatus: 200 };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <TestProviders client={client}>{children}</TestProviders>;
const show = () => render(<ReportsScreen />, { wrapper });

const own = (overrides = {}) =>
  makeReport({ reportedBy: { role: 'searcher', name: 'דנה', callsign: assigned.callsign }, ...overrides });

beforeEach(() => {
  router.push.mockClear();
  mapProps.last = null;
  server.reports = [];
  server.reportsStatus = 200;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/reports')) {
        return server.reportsStatus === 200
          ? json(server.reports)
          : json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, server.reportsStatus);
      }
      if (url.endsWith('/polygons')) return json([polygon(POLYGON_A, 'A'), polygon(POLYGON_B, 'B')]);
      return json({}, 404);
    }),
  );
  useSession.setState({
    ...useSession.getInitialState(),
    restored: true,
    token: 'tok',
    missionId: MISSION_ID,
    participation: assigned,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the reports screen (Fm10)', () => {
  it('names the polygon in the title and offers the list, the filter and a new report', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'דיווחים, פוליגון A' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'סינון דיווחים' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'בפוליגון שלי' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'דיווח חדש' }));
    expect(router.push).toHaveBeenCalledWith('/report', { dangerouslySingular: true });
  });

  it('says it is loading, then that the polygon has no reports', async () => {
    show();
    expect(screen.getByText('טוען דיווחים…')).toBeInTheDocument();
    expect(await screen.findByText('אין עדיין דיווחים בפוליגון')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'שלי' }));
    expect(screen.getByText('עדיין לא שלחת דיווחים')).toBeInTheDocument();
  });

  it('says the reports could not load and tries again', async () => {
    server.reportsStatus = 500;
    show();
    expect(await screen.findByText('לא ניתן לטעון את הדיווחים')).toBeInTheDocument();
    server.reportsStatus = 200;
    server.reports = [makeReport({ text: 'שביל חסום' })];
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(await screen.findByText('שביל חסום')).toBeInTheDocument();
  });

  it('shows a new report of the polygon in the list and on the map, and opens its details', async () => {
    show();
    await screen.findByText('אין עדיין דיווחים בפוליגון');
    const report = makeReport({ text: 'גשר שבור' });
    act(() => applyEvent(client, { type: 'report.saved', missionId: MISSION_ID, report }));

    const card = await screen.findByRole('button', { name: /גשר שבור/ });
    expect(screen.getByText('יוסי דהן')).toBeInTheDocument();
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getAllByText((text) => text.replace(/[\u2066\u2069]/g, '').endsWith(', פוליגון A')).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: 'מפה' }));
    expect(screen.getByRole('img', { name: 'מפת דיווחים בפוליגון' })).toBeInTheDocument();
    expect(mapProps.last?.area.data.reports.map((r) => r.id)).toEqual([report.id]);
    // The open report stays open on the map, above the footer.
    expect(screen.getByRole('button', { name: /גשר שבור/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'רשימה' }));
    expect(screen.queryByRole('img', { name: 'מפת דיווחים בפוליגון' })).toBeNull();
  });

  it('opens a report from its symbol on the map', async () => {
    const report = makeReport({ text: 'גשר שבור' });
    server.reports = [report];
    show();
    await screen.findByText('גשר שבור');
    fireEvent.click(screen.getByRole('radio', { name: 'מפה' }));
    expect(screen.queryByRole('button', { name: /גשר שבור/ })).toBeNull();
    act(() => mapProps.last?.onPressReport?.(report.id));
    expect(screen.getByRole('button', { name: /גשר שבור/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('filters between the polygon’s reports and my own', async () => {
    server.reports = [
      makeReport({ text: 'של חבר' }),
      own({ text: 'שלי בפוליגון' }),
      own({ text: 'שלי מפוליגון אחר', polygonId: POLYGON_B }),
    ];
    show();
    await screen.findByText('של חבר');
    expect(screen.getByText('שלי בפוליגון')).toBeInTheDocument();
    expect(screen.queryByText('שלי מפוליגון אחר')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'שלי' }));
    expect(screen.queryByText('של חבר')).toBeNull();
    expect(screen.getByText('שלי בפוליגון')).toBeInTheDocument();
    expect(screen.getByText('שלי מפוליגון אחר')).toBeInTheDocument();
  });

  it('shows the new polygon’s reports after a reassignment and keeps my own', async () => {
    server.reports = [makeReport({ text: 'בפוליגון A' }), own({ text: 'שלי מ-A' })];
    show();
    await screen.findByText('בפוליגון A');

    server.reports = [makeReport({ text: 'בפוליגון B', polygonId: POLYGON_B }), own({ text: 'שלי מ-A' })];
    const moved = { ...assigned, polygonId: POLYGON_B };
    act(() => {
      applyEvent(client, {
        type: 'participant.updated',
        missionId: MISSION_ID,
        participant: {
          ...moved,
          searcherId: '00000000-0000-4000-8000-000000000105',
          name: 'דנה',
          phone: '+972526114085',
          position: null,
          positionAt: null,
          gpsUnavailableSince: null,
          battery: null,
        },
      });
    });
    expect(await screen.findByText('בפוליגון B')).toBeInTheDocument();
    expect(screen.queryByText('בפוליגון A')).toBeNull();
    expect(screen.queryByText('שלי מ-A')).toBeNull();
    expect(screen.getByRole('heading', { name: 'דיווחים, פוליגון B' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'שלי' }));
    expect(screen.getByText('שלי מ-A')).toBeInTheDocument();
  });

  it('does not show a stale report of another polygon that reached the cache', async () => {
    show();
    await screen.findByText('אין עדיין דיווחים בפוליגון');
    act(() =>
      applyEvent(client, {
        type: 'report.saved',
        missionId: MISSION_ID,
        report: makeReport({ text: 'רחוק', polygonId: POLYGON_B }),
      }),
    );
    expect(screen.queryByText('רחוק')).toBeNull();
    expect(client.getQueryData(missionKeys.reports(MISSION_ID))).toHaveLength(1);
  });

  it('shows an Available searcher only their own reports, without the filter', async () => {
    useSession.setState({ participation: { ...assigned, status: 'available', polygonId: null, taskStatus: null } });
    server.reports = [own({ text: 'ששלחתי', polygonId: POLYGON_A }), makeReport({ text: 'של אחר' })];
    show();
    expect(await screen.findByText('ששלחתי')).toBeInTheDocument();
    expect(screen.queryByText('של אחר')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'סינון דיווחים' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'דיווחים' })).toBeInTheDocument();
  });

  it('shows a report that waits on the phone, once, until the server has it', async () => {
    const waiting = {
      id: '0190a3b2-7c4e-7a10-8a5e-00000000feed',
      type: 'general',
      text: 'עוד לא נשלח',
      position: { type: 'Point', coordinates: [35.01, 31.74] },
      accuracy: null,
      reportedAt: '2026-10-03T17:00:00.000Z',
    };
    await enqueue({ kind: 'report', missionId: MISSION_ID, payloads: [waiting], ids: [waiting.id] });
    show();
    expect(await screen.findByText('עוד לא נשלח')).toBeInTheDocument();
    expect(screen.getByText('ממתין לסנכרון')).toBeInTheDocument();

    server.reports = [own({ id: waiting.id, text: 'עוד לא נשלח', reportedAt: waiting.reportedAt })];
    await act(() => client.invalidateQueries({ queryKey: missionKeys.reports(MISSION_ID) }));
    await waitFor(() => expect(screen.getAllByText('עוד לא נשלח')).toHaveLength(1));
  });

  it('switches to the map and back', async () => {
    show();
    await screen.findByText('אין עדיין דיווחים בפוליגון');
    fireEvent.click(screen.getByRole('radio', { name: 'מפה' }));
    expect(screen.getByRole('radio', { name: 'מפה' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('img', { name: 'מפת דיווחים בפוליגון' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'רשימה' }));
    expect(screen.getByText('אין עדיין דיווחים בפוליגון')).toBeInTheDocument();
  });

  it('shows the distance from me when the phone gave a position', async () => {
    const location = await import('expo-location');
    vi.mocked(location.getForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
    vi.mocked(location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 31.7411, longitude: 35.0152, accuracy: 5 },
      timestamp: 1,
    } as never);
    server.reports = [makeReport()];
    show();
    expect(await screen.findByText('· 110 מ׳ ממני')).toBeInTheDocument();
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    vi.mocked(location.getForegroundPermissionsAsync).mockResolvedValue({ granted: false } as never);
  });

  it.each(['night', 'day'] as const)('renders in the %s theme', async (id) => {
    const { usePreferences } = await import('../state/preferences');
    usePreferences.setState({ themePreference: id });
    server.reports = [makeReport({ text: 'גשר שבור' })];
    show();
    const list = await screen.findByLabelText('רשימת דיווחים');
    expect(within(list).getByText('גשר שבור')).toBeInTheDocument();
    usePreferences.setState(usePreferences.getInitialState());
  });
});
