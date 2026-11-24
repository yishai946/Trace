import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadinessPermissions } from '.';
import { useOfflineState } from '../../offline/state';
import type { OfflineStep } from '../../offline/store';
import type { FieldPermissions } from '../../permissions/devicePermissions';
import { useSession } from '../../state/session';
import { TestProviders } from '../../test/providers';

const MISSION = '00000000-0000-4000-8000-000000000001';
const FULL: OfflineStep[] = ['mission', 'photo', 'polygons', 'map'];

const device = vi.hoisted(() => ({ read: vi.fn(), request: vi.fn() }));
vi.mock('../../permissions/devicePermissions', () => ({
  readPermissions: device.read,
  requestPermission: device.request,
}));

const permissions = (override: Partial<FieldPermissions> = {}): FieldPermissions => ({
  location: 'granted',
  backgroundLocation: 'granted',
  push: 'granted',
  camera: 'ask',
  ...override,
});

function showing(saved: OfflineStep[], given: Partial<FieldPermissions> = {}) {
  device.read.mockResolvedValue(permissions(given));
  useSession.setState({ missionId: MISSION });
  useOfflineState.setState({ missionId: MISSION, saved, loaded: true, running: false, failed: false, refused: false });
  return render(<ReadinessPermissions />, { wrapper: TestProviders });
}

beforeEach(() => {
  device.read.mockReset();
  device.request.mockReset();
});

afterEach(() => {
  useSession.setState({ missionId: null });
  useOfflineState.setState({ missionId: null, saved: [], loaded: false, failed: false });
});

describe('ReadinessPermissions', () => {
  it('shows nothing until the phone says what it allows', () => {
    device.read.mockReturnValue(new Promise(() => {}));
    render(<ReadinessPermissions />, { wrapper: TestProviders });
    expect(screen.queryByText('הרשאות')).not.toBeInTheDocument();
  });

  it('lists each permission with its state: granted ones are marked, the others offer a button', async () => {
    showing(FULL, { backgroundLocation: 'ask', push: 'ask' });
    expect(await screen.findByRole('heading', { name: 'הרשאות' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('מאושר')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'אשר מיקום ברקע' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'אשר התראות Push' })).toBeInTheDocument();
    expect(screen.getAllByText('חובה')).toHaveLength(3);
    expect(screen.getByText('רשות')).toBeInTheDocument();
    expect(screen.getByText('בעת צילום')).toBeInTheDocument();
  });

  it('asks the phone for the permission the searcher chose, then shows it again', async () => {
    showing(FULL, { push: 'ask' });
    device.read.mockResolvedValue(permissions());
    fireEvent.click(await screen.findByRole('button', { name: 'אשר התראות Push' }));
    await waitFor(() => expect(device.request).toHaveBeenCalledWith('push'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'אשר התראות Push' })).not.toBeInTheDocument());
  });

  it('sends a searcher who refused for good to the phone settings', async () => {
    showing(FULL, { location: 'blocked' });
    expect(await screen.findByRole('button', { name: 'פתח הגדרות עבור מיקום' })).toBeInTheDocument();
  });

  it('has no banner when the package is saved and every required permission is granted', async () => {
    showing(FULL);
    await screen.findByRole('heading', { name: 'הרשאות' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists the missing permissions and the unfinished download in one banner', async () => {
    showing(['mission'], { backgroundLocation: 'ask', push: 'blocked' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '"התחל חיפוש" חסום. חסר: מיקום ברקע, התראות Push, השלמת ההורדה. אפשר לצפות במסע גם עכשיו.',
    );
  });

  it('blocks on a missing permission alone', async () => {
    showing(FULL, { location: 'ask' });
    expect(await screen.findByRole('alert')).toHaveTextContent('חסר: מיקום. אפשר');
  });

  it('blocks on the download alone, and does not call an unread package missing', async () => {
    showing(['mission']);
    expect(await screen.findByRole('alert')).toHaveTextContent('חסר: השלמת ההורדה.');
  });

  it('keeps the banner out while the device has not said what it holds', async () => {
    showing([], { location: 'ask' });
    useOfflineState.setState({ loaded: false });
    await screen.findByRole('heading', { name: 'הרשאות' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
