import type { RequiredPermission } from '@trace/domain';

/** The Hebrew name of each required permission, as the searcher sees it in Fm03 and on Fm05. */
export const PERMISSION_NAMES: Record<RequiredPermission, string> = {
  location: 'מיקום',
  backgroundLocation: 'מיקום ברקע',
  push: 'התראות Push',
};
