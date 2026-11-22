import type { RequiredPermission } from '@trace/domain';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { readPermissions, requestPermission, type FieldPermissions } from '../devicePermissions';

export interface PermissionsHook {
  /** `null` until the phone has answered. */
  permissions: FieldPermissions | null;
  /** Shows the phone's prompt, or opens the phone settings when the searcher already refused for good. */
  grant: (permission: RequiredPermission) => Promise<void>;
}

/**
 * The permissions of Fm03 (UC-F03, UC-F06): read when the screen opens and whenever the app returns to the front, since
 * the searcher may have changed them in the phone settings.
 */
export function usePermissions(): PermissionsHook {
  const [permissions, setPermissions] = useState<FieldPermissions | null>(null);
  // Bumped after a prompt, so the effect reads again.
  const [reloaded, setReloaded] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      void readPermissions().then((read) => {
        if (active) setPermissions(read);
      });
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [reloaded]);

  const grant = useCallback(
    async (permission: RequiredPermission) => {
      if (permissions?.[permission] === 'blocked') {
        await Linking.openSettings();
        return;
      }
      await requestPermission(permission);
      setReloaded((count) => count + 1);
    },
    [permissions],
  );

  return { permissions, grant };
}
