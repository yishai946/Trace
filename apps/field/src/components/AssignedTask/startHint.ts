import type { StartSearchBlockers } from '@trace/domain';
import { PERMISSION_NAMES } from '../../permissions/permissionNames';

/** What Fm05 says under the closed "התחל חיפוש" (UC-F06 alternative scenario): what is missing and how to grant it. */
export function startHint({ missingParts, missingPermissions }: StartSearchBlockers): string {
  const missing = [
    ...missingPermissions.map((permission) => PERMISSION_NAMES[permission]),
    ...(missingParts.length ? ['השלמת ההורדה ללא חיבור'] : []),
  ];
  const how = missingPermissions.length ? ' אפשר לאשר הרשאות במסך ההרשאות או בהגדרות הטלפון.' : '';
  return `אפשר להתחיל חיפוש רק אחרי שהכול מוכן. חסר: ${missing.join(', ')}.${how}`;
}
