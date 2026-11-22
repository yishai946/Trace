import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPermissions, requestPermission } from '.';

const mocks = vi.hoisted(() => ({
  foreground: vi.fn(),
  background: vi.fn(),
  requestForeground: vi.fn(),
  requestBackground: vi.fn(),
  push: vi.fn(),
  requestPush: vi.fn(),
  camera: vi.fn(),
}));

vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: mocks.foreground,
  getBackgroundPermissionsAsync: mocks.background,
  requestForegroundPermissionsAsync: mocks.requestForeground,
  requestBackgroundPermissionsAsync: mocks.requestBackground,
}));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: mocks.push,
  requestPermissionsAsync: mocks.requestPush,
}));
vi.mock('expo-camera', () => ({ Camera: { getCameraPermissionsAsync: mocks.camera } }));

const granted = { status: 'granted', granted: true, canAskAgain: true };
const undecided = { status: 'undetermined', granted: false, canAskAgain: true };
const refused = { status: 'denied', granted: false, canAskAgain: false };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.foreground.mockResolvedValue(granted);
  mocks.background.mockResolvedValue(undecided);
  mocks.push.mockResolvedValue(refused);
  mocks.camera.mockResolvedValue(undecided);
});

describe('readPermissions', () => {
  it('names each permission granted, to ask for, or blocked in the phone settings', async () => {
    expect(await readPermissions()).toEqual({
      location: 'granted',
      backgroundLocation: 'ask',
      push: 'blocked',
      camera: 'ask',
    });
  });

  it('reports a permission it cannot read as one to ask for', async () => {
    mocks.foreground.mockRejectedValue(new Error('no module'));
    expect((await readPermissions()).location).toBe('ask');
  });
});

describe('requestPermission', () => {
  it('asks for foreground location', async () => {
    await requestPermission('location');
    expect(mocks.requestForeground).toHaveBeenCalledTimes(1);
  });

  it('asks for background location only after foreground location is granted', async () => {
    mocks.foreground.mockResolvedValue(undecided);
    mocks.requestForeground.mockResolvedValue(undecided);
    await requestPermission('backgroundLocation');
    expect(mocks.requestBackground).not.toHaveBeenCalled();

    mocks.requestForeground.mockResolvedValue(granted);
    await requestPermission('backgroundLocation');
    expect(mocks.requestBackground).toHaveBeenCalledTimes(1);
  });

  it('asks for notifications', async () => {
    await requestPermission('push');
    expect(mocks.requestPush).toHaveBeenCalledTimes(1);
  });
});
