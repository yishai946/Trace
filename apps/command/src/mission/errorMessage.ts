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

const SIGHTING_MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. השינוי לא נשמר.',
  NOT_FOUND: 'התצפית כבר לא קיימת. רעננו את המפה.',
  MISSION_ENDED: 'המסע הסתיים. אי אפשר לשנות LKP ותצפיות.',
  SIGHTING_NOT_LKP_CANDIDATE: 'כבר הוחלט על התצפית, או שהיא אינה מאוחרת מה-LKP הנוכחי.',
};

const ASSIGN_MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. השיבוץ לא נשמר.',
  NOT_FOUND: 'המחפש כבר לא במסע. רעננו את הרשימה.',
  POLYGON_NOT_FOUND: 'הפוליגון כבר לא במפה.',
  PARTICIPATION_ENDED: 'המחפש סיים את הפעילות במסע.',
  MISSION_ENDED: 'המסע הסתיים. אי אפשר לשבץ.',
};

/** A Hebrew message for a failed assignment (UC-C09). */
export function assignErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && ASSIGN_MESSAGES[error.code]) || 'השיבוץ לא נשמר. נסו שוב.';
}

/** A Hebrew message for a failed sighting or LKP change. */
export function sightingErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && SIGHTING_MESSAGES[error.code]) || 'השינוי לא נשמר. נסו שוב.';
}
