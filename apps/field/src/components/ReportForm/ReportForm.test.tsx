import { themes } from '@trace/design';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportForm } from '.';
import { pending } from '../../outbox';
import { usePreferences } from '../../state/preferences';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';
import { PendingReports } from '../PendingReports';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
const network = vi.hoisted(() => ({
  state: { isConnected: true, isInternetReachable: true } as { isConnected: boolean; isInternetReachable: boolean },
  listeners: new Set<(state: object) => void>(),
}));
const camera = vi.hoisted(() => ({
  permission: { granted: false, canAskAgain: false },
  request: vi.fn(),
  take: vi.fn(),
}));
vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Platform: {
    get OS() {
      return platform.OS;
    },
    select: (o: Record<string, unknown>) => o.ios ?? o.default,
  },
}));
vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn(async () => network.state),
  addNetworkStateListener: (listener: (state: object) => void) => {
    network.listeners.add(listener);
    return { remove: () => network.listeners.delete(listener) };
  },
}));
vi.mock('expo-task-manager', () => ({ defineTask: vi.fn() }));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestForegroundPermissionsAsync: vi.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: vi.fn(async () => ({
    coords: { latitude: 31.7412, longitude: 35.0139, accuracy: 6 },
    timestamp: Date.UTC(2026, 9, 3, 13, 58),
  })),
}));
vi.mock('expo-image-picker', () => ({
  useCameraPermissions: () => [camera.permission, camera.request],
  launchCameraAsync: vi.fn(),
}));
vi.mock('../../reports/photo', () => ({ takeReportPhoto: camera.take }));

const missionId = '00000000-0000-4000-8000-000000000001';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const saved = (body: Record<string, unknown>) => ({
  ...body,
  missionId,
  polygonId: null,
  status: 'new',
  reportedBy: { role: 'searcher', name: 'דנה', callsign: 4 },
  hasPhoto: false,
  createdAt: '2026-10-03T10:02:00.000Z',
});
/** A server that saves what it is sent; the calls are recorded. */
const stubServer = () => {
  const fetch = vi.fn(async (_url: string, init: RequestInit) =>
    typeof init.body === 'string' ? json(201, saved(JSON.parse(init.body))) : json(200, saved({})),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const setup = (props: { onDone?: () => void; onCancel?: () => void; polygonName?: string | null } = {}) => {
  const onDone = props.onDone ?? vi.fn();
  render(
    <TestProviders>
      <ReportForm
        missionId={missionId}
        polygonName={props.polygonName ?? null}
        onCancel={props.onCancel ?? vi.fn()}
        onDone={onDone}
      />
      <PendingReports missionId={missionId} />
    </TestProviders>,
  );
  return { onDone };
};
const send = () => screen.getByRole('button', { name: 'שלח דיווח' });
const ready = () => waitFor(() => expect(send()).not.toHaveAttribute('aria-disabled', 'true'));
const fill = (type = 'מפגע', text = 'מדרון חלק') => {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${type}`) }));
  fireEvent.change(screen.getByLabelText('פירוט'), { target: { value: text } });
};

beforeEach(() => {
  platform.OS = 'ios';
  network.state = { isConnected: true, isInternetReachable: true };
  network.listeners.clear();
  camera.permission = { granted: false, canAskAgain: false };
  camera.request.mockReset();
  camera.take.mockReset();
  usePreferences.setState(usePreferences.getInitialState());
  useSession.setState({ ...useSession.getInitialState(), token: 't1', missionId });
});
afterEach(() => vi.unstubAllGlobals());

describe('ReportForm', () => {
  it('shows the screen of Fm08: category, details, photo, location and the offline note', async () => {
    setup({ polygonName: 'פוליגון A' });
    expect(screen.getByRole('heading', { name: 'דיווח חדש' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'קטגוריה' })).toBeInTheDocument();
    expect(screen.getByLabelText('פירוט')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'צרף תמונה' })).toBeInTheDocument();
    expect(screen.getByText('מיקום ושעה אוטומטיים')).toBeInTheDocument();
    expect(screen.getByText('פוליגון A')).toBeInTheDocument();
    expect(screen.getByText('אם אין חיבור, הדיווח נשמר במכשיר ויסונכרן אוטומטית.')).toBeInTheDocument();
    await ready();
  });

  it('cancels', async () => {
    const onCancel = vi.fn();
    setup({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(onCancel).toHaveBeenCalledOnce();
    await ready();
  });

  it('keeps send disabled while locating', () => {
    setup();
    expect(screen.getByText('מאתר מיקום…')).toBeInTheDocument();
    expect(send()).toHaveAttribute('aria-disabled', 'true');
  });

  it('asks for a category and for details, and saves nothing', async () => {
    const fetch = stubServer();
    setup();
    await ready();

    fireEvent.click(send());
    expect(await screen.findByText('בחר קטגוריה.')).toBeInTheDocument();
    expect(screen.getByText('כתוב מה ראית.')).toBeInTheDocument();
    expect(await pending()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the report online and finishes without a warning', async () => {
    const fetch = stubServer();
    const { onDone } = setup();
    await ready();
    fill();
    fireEvent.click(send());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/missions/${missionId}/reports`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      type: 'hazard',
      text: 'מדרון חלק',
      position: { type: 'Point', coordinates: [35.0139, 31.7412] },
      accuracy: 6,
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await pending()).toEqual([]);
  });

  it('in airplane mode keeps the report as waiting, and sends it when the connection is back', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    const fetch = stubServer();
    const { onDone } = setup();
    await ready();
    fill();
    fireEvent.click(send());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(fetch).not.toHaveBeenCalled();
    expect(await screen.findByText('דיווח ממתין לשליחה')).toBeInTheDocument();
    expect((await pending()).map((item) => item.kind)).toEqual(['report']);

    // The connection comes back: the outbox sync that the app runs sends it.
    const { useOutboxSync } = await import('../../tracking');
    renderHook(() => useOutboxSync());
    network.state = { isConnected: true, isInternetReachable: true };
    await act(async () => network.listeners.forEach((listener) => listener(network.state)));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[0]).toBe(`https://api.test/api/missions/${missionId}/reports`);
    await waitFor(() => expect(screen.queryByText('דיווח ממתין לשליחה')).toBeNull());
    expect(await pending()).toEqual([]);
  });

  it('warns clearly when "הנעדר אותר" could not be sent, and goes back to the map from there', async () => {
    network.state = { isConnected: false, isInternetReachable: false };
    stubServer();
    const { onDone } = setup();
    await ready();
    fill('הנעדר אותר', 'נמצא ליד העץ');
    fireEvent.click(send());

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('לא הגיע למנהל');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'חזרה למפה' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('warns that the report was not accepted when the mission ended, and never calls it sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { error: { code: 'MISSION_ENDED', message: 'ended' } })),
    );
    const { onDone } = setup();
    await ready();
    fill('הנעדר אותר', 'נמצא ליד העץ');
    fireEvent.click(send());

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('לא התקבל');
    expect(warning).toHaveTextContent('הנעדר אותר');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText('דיווח ממתין לשליחה')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'חזרה למפה' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('sends the report without a photo when the camera is not allowed', async () => {
    const fetch = stubServer();
    const { onDone } = setup();
    await ready();
    expect(screen.getByText('אין הרשאה למצלמה. אפשר לשלוח בלי תמונה.')).toBeInTheDocument();
    fill();
    fireEvent.click(send());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(fetch.mock.calls.map((call) => (call[1] as RequestInit).method)).toEqual(['POST']);
    expect(camera.take).not.toHaveBeenCalled();
  });

  it('sends the report and then its photo', async () => {
    camera.permission = { granted: true, canAskAgain: true };
    camera.take.mockResolvedValue({ uri: 'file:///small.jpg', base64: btoa('JPEG') });
    const fetch = stubServer();
    const { onDone } = setup();
    await ready();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'צרף תמונה' }));
    expect(await screen.findByText('תמונה מצורפת', {}, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.click(send());

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce(), { timeout: 4000 });
    expect(fetch.mock.calls.map((call) => (call[1] as RequestInit).method)).toEqual(['POST', 'PUT']);
    expect(fetch.mock.calls[1]?.[0]).toMatch(/\/reports\/[0-9a-f-]+\/photo$/);
  });

  it('saves one report when send is pressed twice', async () => {
    const fetch = stubServer();
    const { onDone } = setup();
    await ready();
    fill();
    const button = send();
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('tells the searcher when the report could not be saved on the phone, and keeps the form', async () => {
    const outbox = await import('../../outbox');
    vi.spyOn(outbox, 'enqueue').mockRejectedValueOnce(new Error('disk full'));
    const { onDone } = setup();
    await ready();
    fill();
    fireEvent.click(send());

    expect(await screen.findByText('לא ניתן לשמור את הדיווח במכשיר. נסה שוב.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('פירוט')).toHaveValue('מדרון חלק');
  });

  it.each(['night', 'day'] as const)('uses the %s theme for the chosen category', async (id) => {
    usePreferences.setState({ themePreference: id });
    setup();
    await ready();
    fireEvent.click(screen.getByRole('radio', { name: 'מפגע' }));
    expect(screen.getByRole('radio', { name: 'מפגע' })).toHaveStyle({ borderColor: themes[id].color.accent });
  });

  it.each(['night', 'day'] as const)('uses the %s warning border for the "located" warning', async (id) => {
    usePreferences.setState({ themePreference: id });
    network.state = { isConnected: false, isInternetReachable: false };
    setup();
    await ready();
    fill('הנעדר אותר', 'נמצא');
    fireEvent.click(send());
    expect(await screen.findByRole('alert')).toHaveStyle({ borderColor: themes[id].color.warning });
  });
});

describe('without a position', () => {
  it('keeps send disabled and says why', async () => {
    const location = await import('expo-location');
    vi.mocked(location.getCurrentPositionAsync).mockRejectedValueOnce(new Error('no gps'));
    setup();
    expect(await screen.findByText('אין מיקום GPS. הפעל את שירותי המיקום בטלפון כדי לשלוח.')).toBeInTheDocument();
    expect(send()).toHaveAttribute('aria-disabled', 'true');
  });
});
