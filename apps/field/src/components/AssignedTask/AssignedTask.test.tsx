import { themes } from '@trace/design';
import type { MissionPolygon, OwnParticipation } from '@trace/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignedTask } from '.';
import type { FieldPermissions } from '../../permissions/devicePermissions';
import { useOfflineState } from '../../offline/state';
import { useSession } from '../../state/session';
import { usePreferences } from '../../state/preferences';
import { TestProviders } from '../../test/providers';

const polygon = (id: string, name: string, activeSearchers: number): MissionPolygon => ({
  id,
  missionId: '00000000-0000-4000-8000-000000000001',
  name,
  status: 'active',
  coverage: null,
  activeSearchers,
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
const polygons = [
  polygon('00000000-0000-4000-8000-0000000000a1', 'ואדי צפוני', 7),
  polygon('00000000-0000-4000-8000-0000000000b2', 'מדרון דרומי', 1),
];
const participation: OwnParticipation = {
  id: '00000000-0000-4000-8000-000000000002',
  callsign: 4,
  status: 'assigned',
  polygonId: polygons[0]?.id ?? null,
  taskStatus: 'ready',
};

const device = vi.hoisted(() => ({ read: vi.fn(), request: vi.fn() }));
vi.mock('../../permissions/devicePermissions', () => ({
  readPermissions: device.read,
  requestPermission: device.request,
}));
const granted = (override: Partial<FieldPermissions> = {}): FieldPermissions => ({
  location: 'granted',
  backgroundLocation: 'granted',
  push: 'granted',
  camera: 'ask',
  ...override,
});

const MISSION = '00000000-0000-4000-8000-000000000001';
const setSaved = (saved: ('mission' | 'photo' | 'polygons' | 'map')[]) => {
  useSession.setState({ missionId: MISSION });
  useOfflineState.setState({ missionId: MISSION, saved, loaded: true, running: false, failed: false });
};

beforeEach(() => {
  device.read.mockReset();
  device.read.mockResolvedValue(granted());
});

afterEach(() => {
  usePreferences.setState(usePreferences.getInitialState());
  useSession.setState({ missionId: null });
  useOfflineState.setState({ missionId: null, saved: [], loaded: false });
});
const renderTask = (props: Partial<Parameters<typeof AssignedTask>[0]> = {}) =>
  render(
    <AssignedTask
      participation={participation}
      polygons={polygons}
      notice={null}
      onDismissNotice={() => {}}
      {...props}
    />,
    { wrapper: TestProviders },
  );

describe('AssignedTask', () => {
  it('shows the assigned polygon and waits for Start Search', () => {
    renderTask();
    expect(screen.getByText('שובצת לפוליגון ואדי צפוני')).toBeInTheDocument();
    expect(screen.getByText('7 מחפשים בפוליגון')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
  });

  it('blocks Start Search and says why until the offline package is saved', async () => {
    setSaved(['mission', 'photo']);
    renderTask({ onStartSearch: () => {} });
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
    expect(await screen.findByText(/חסר: השלמת ההורדה/)).toBeInTheDocument();
  });

  it('opens Start Search once the offline package is saved and the permissions are granted', async () => {
    setSaved(['mission', 'photo', 'polygons', 'map']);
    const onStartSearch = vi.fn();
    renderTask({ onStartSearch });
    expect(await screen.findByText(/מעקב המיקום והמסלול מתחילים/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'התחל חיפוש' }));
    expect(onStartSearch).toHaveBeenCalled();
  });

  it('shows why the start failed and keeps the button open to try again', async () => {
    setSaved(['mission', 'photo', 'polygons', 'map']);
    renderTask({ onStartSearch: () => {}, startError: 'אין חיבור לשרת. החיפוש לא התחיל, נסו שוב.' });
    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור לשרת. החיפוש לא התחיל, נסו שוב.');
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeEnabled();
  });

  it('closes the button while the start is on its way', async () => {
    setSaved(['mission', 'photo', 'polygons', 'map']);
    renderTask({ onStartSearch: () => {}, starting: true });
    expect(await screen.findByText(/מעקב המיקום והמסלול מתחילים/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
  });

  it('replaces Start Search with the searching state once the search started', () => {
    renderTask({ participation: { ...participation, taskStatus: 'searching' } });
    expect(screen.getByText('בחיפוש, ואדי צפוני')).toBeInTheDocument();
    expect(screen.getByText('המסלול שלך נרשם והמנהל רואה אותך על המפה')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'התחל חיפוש' })).not.toBeInTheDocument();
  });

  it('pauses a searching task with one tap and not twice while it is on its way', () => {
    const onPause = vi.fn();
    const { rerender } = renderTask({ participation: { ...participation, taskStatus: 'searching' }, onPause });
    fireEvent.click(screen.getByRole('button', { name: 'השהה' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    rerender(
      <AssignedTask
        participation={{ ...participation, taskStatus: 'searching' }}
        polygons={polygons}
        notice={null}
        onDismissNotice={() => {}}
        onPause={onPause}
        pausing
      />,
    );
    expect(screen.getByRole('button', { name: 'השהה' })).toBeDisabled();
  });

  it('shows a paused search with Resume and says safety tracking goes on', () => {
    const onResume = vi.fn();
    renderTask({ participation: { ...participation, taskStatus: 'paused' }, onResume });
    expect(screen.getByText('מושהה, ואדי צפוני')).toBeInTheDocument();
    expect(screen.getByText(/מעקב הבטיחות ממשיך/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'התחל חיפוש' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'המשך חיפוש' }));
    expect(onResume).toHaveBeenCalled();
  });

  it('shows why a pause or resume failed', () => {
    renderTask({
      participation: { ...participation, taskStatus: 'paused' },
      onResume: () => {},
      pauseError: 'המסע מושהה. אפשר להמשיך חיפוש רק כשהמסע פעיל.',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('המסע מושהה');
    expect(screen.getByRole('button', { name: 'המשך חיפוש' })).toBeEnabled();
  });

  it('hides the personal Resume while the commander paused the mission and says to wait (UC-C15)', () => {
    renderTask({ participation: { ...participation, taskStatus: 'paused' }, onResume: vi.fn(), missionPaused: true });
    expect(screen.queryByRole('button', { name: 'המשך חיפוש' })).not.toBeInTheDocument();
    expect(screen.getByText(/המנהל השהה את החיפוש/)).toBeInTheDocument();
  });

  it('hides Start Search and Finish while the mission is paused, and says to wait (UC-C15)', () => {
    const { unmount } = renderTask({ onStartSearch: vi.fn(), missionPaused: true });
    expect(screen.queryByRole('button', { name: 'התחל חיפוש' })).not.toBeInTheDocument();
    expect(screen.getByText(/המנהל השהה את החיפוש/)).toBeInTheDocument();
    unmount();
    renderTask({ participation: { ...participation, taskStatus: 'paused' }, onFinish: vi.fn(), missionPaused: true });
    expect(screen.queryByRole('button', { name: /סיימתי חיפוש/ })).not.toBeInTheDocument();
  });

  it('shows Start Search again once the commander resumed and the task is back at Ready (UC-C15)', () => {
    renderTask({ participation, onStartSearch: vi.fn(), missionPaused: false });
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeInTheDocument();
  });

  it('offers "סיימתי חיפוש" while searching and while paused', () => {
    const onFinish = vi.fn();
    const { rerender } = renderTask({ participation: { ...participation, taskStatus: 'searching' }, onFinish });
    expect(screen.getByRole('button', { name: 'סיימתי חיפוש…' })).toBeInTheDocument();
    rerender(
      <AssignedTask
        participation={{ ...participation, taskStatus: 'paused' }}
        polygons={polygons}
        notice={null}
        onDismissNotice={() => {}}
        onFinish={onFinish}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'סיימתי חיפוש…' }));
    fireEvent.click(screen.getByRole('button', { name: 'סיים חיפוש' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows a finished search as still assigned, with nothing to press', () => {
    renderTask({ participation: { ...participation, taskStatus: 'finished' } });
    expect(screen.getByText('סיימת חיפוש, ואדי צפוני')).toBeInTheDocument();
    expect(screen.getByText(/המנהל יחליט מה הלאה/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'התחל חיפוש' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'השהה' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'סיימתי חיפוש…' })).not.toBeInTheDocument();
  });

  it('blocks Start Search and names the missing permissions and how to grant them', async () => {
    device.read.mockResolvedValue(granted({ backgroundLocation: 'ask', push: 'ask' }));
    setSaved(['mission', 'photo', 'polygons', 'map']);
    renderTask({ onStartSearch: () => {} });
    expect(await screen.findByText(/חסר: מיקום ברקע, התראות Push/)).toBeInTheDocument();
    expect(screen.getByText(/בהגדרות הטלפון/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'אשר הרשאה' }));
    await waitFor(() => expect(device.request).toHaveBeenCalledWith('backgroundLocation'));
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
  });

  it('keeps Start Search closed without a claim about permissions until the phone answers', () => {
    device.read.mockReturnValue(new Promise(() => {}));
    setSaved(['mission', 'photo', 'polygons', 'map']);
    renderTask({ onStartSearch: () => {} });
    expect(screen.getByRole('button', { name: 'התחל חיפוש' })).toBeDisabled();
    expect(screen.queryByText(/חסר:/)).not.toBeInTheDocument();
  });

  it('names both the missing offline package and the permissions', async () => {
    device.read.mockResolvedValue(granted({ location: 'ask' }));
    setSaved(['mission']);
    renderTask({ onStartSearch: () => {} });
    expect(await screen.findByText(/חסר: מיקום, השלמת ההורדה/)).toBeInTheDocument();
  });

  it('tells the searcher they were moved, until they dismiss it', () => {
    const onDismissNotice = vi.fn();
    renderTask({
      participation: { ...participation, polygonId: polygons[1]?.id ?? null },
      notice: { kind: 'moved', polygonId: polygons[1]?.id ?? '' },
      onDismissNotice,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('הועברת לפוליגון מדרון דרומי. המשימה הקודמת נשמרה.');
    expect(screen.getByText('מחפש אחד בפוליגון')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'הבנתי' }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  it('says it without a name while the polygons load', () => {
    renderTask({ polygons: [], notice: { kind: 'moved', polygonId: participation.polygonId ?? '' } });
    expect(screen.getByText('שובצת לפוליגון')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('הועברת לפוליגון. המשימה הקודמת נשמרה.');
  });

  it.each(['night', 'day'] as const)('works in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    renderTask({ notice: { kind: 'assigned', polygonId: polygons[0]?.id ?? '' } });
    expect(screen.getByRole('alert')).toHaveStyle({ borderColor: themes[id].color.accent });
  });
});
