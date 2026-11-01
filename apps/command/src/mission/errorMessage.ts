import { ApiRequestError } from '../api';

const MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. השינוי לא נשמר.',
  NOT_FOUND: 'הפוליגון כבר לא קיים. רעננו את המפה.',
  MISSION_NOT_ACTIVE: 'אפשר לשנות פוליגונים רק כשהמסע פעיל.',
  INVALID_GEOMETRY: 'גבול הפוליגון אינו תקין.',
  POLYGON_HAS_ACTIVE_SEARCHERS: 'אי אפשר למחוק פוליגון שיש בו מחפש פעיל.',
};

/** A Hebrew message for a failed polygon change. */
export function errorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'השינוי לא נשמר. נסו שוב.';
}
