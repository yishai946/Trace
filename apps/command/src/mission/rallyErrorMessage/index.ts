import { ApiRequestError } from '../../api';

const MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. נקודת הכינוס לא נשמרה.',
  MISSION_ENDED: 'אי אפשר לשנות נקודת כינוס במסע שהסתיים.',
  VALIDATION_ERROR: 'הקואורדינטות אינן תקינות.',
  FORBIDDEN: 'המסע לא זמין לשינוי. רעננו את המסך.',
  NOT_FOUND: 'המסע לא זמין לשינוי. רעננו את המסך.',
};

/** A Hebrew message for a failed rally point change (UC-C05). */
export function rallyErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'נקודת הכינוס לא נשמרה. נסו שוב.';
}
