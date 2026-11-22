import type { RequiredPermission, StartSearchBlockers } from '@trace/domain';

const PERMISSION_NAMES: Record<RequiredPermission, string> = {
  location: 'מיקום',
  backgroundLocation: 'מיקום ברקע',
  push: 'התראות Push',
};

/** The banner of Fm03: that Start Search is closed, what is missing, and that watching the mission is still open. */
export function blockedSummary({ missingParts, missingPermissions }: StartSearchBlockers): string {
  const missing = [
    ...missingPermissions.map((permission) => PERMISSION_NAMES[permission]),
    ...(missingParts.length ? ['השלמת ההורדה'] : []),
  ];
  return `"התחל חיפוש" חסום. חסר: ${missing.join(', ')}. אפשר לצפות במסע גם עכשיו.`;
}
