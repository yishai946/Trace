import type { RequiredPermission } from '@trace/domain';
import { Camera } from 'expo-camera';
import {
  getBackgroundPermissionsAsync,
  getForegroundPermissionsAsync,
  requestBackgroundPermissionsAsync,
  requestForegroundPermissionsAsync,
} from 'expo-location';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';

/** `ask`: the phone can still show its prompt; `blocked`: the searcher refused and only the phone settings can change it. */
export type PermissionState = 'granted' | 'ask' | 'blocked';

export type FieldPermissions = Record<RequiredPermission | 'camera', PermissionState>;

interface PermissionAnswer {
  granted: boolean;
  canAskAgain: boolean;
}

const stateOf = ({ granted, canAskAgain }: PermissionAnswer): PermissionState =>
  granted ? 'granted' : canAskAgain ? 'ask' : 'blocked';

/** A permission the phone cannot report (no native module, web) is one to ask for, never a reason to crash. */
async function read(get: () => Promise<PermissionAnswer>): Promise<PermissionState> {
  try {
    return stateOf(await get());
  } catch {
    return 'ask';
  }
}

/** What the phone allows now (UC-F03 readiness, UC-F06 preconditions). Reading never shows a prompt. */
export async function readPermissions(): Promise<FieldPermissions> {
  const [location, backgroundLocation, push, camera] = await Promise.all([
    read(getForegroundPermissionsAsync),
    read(getBackgroundPermissionsAsync),
    read(getPermissionsAsync),
    read(() => Camera.getCameraPermissionsAsync()),
  ]);
  return { location, backgroundLocation, push, camera };
}

/** Shows the phone's prompt for one required permission. Background location is only asked once foreground is granted. */
export async function requestPermission(permission: RequiredPermission): Promise<void> {
  if (permission === 'push') {
    await requestPermissionsAsync();
    return;
  }
  const foreground = await requestForegroundPermissionsAsync();
  if (permission === 'backgroundLocation' && foreground.granted) await requestBackgroundPermissionsAsync();
}
