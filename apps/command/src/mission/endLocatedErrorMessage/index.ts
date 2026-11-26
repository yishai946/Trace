import { ApiRequestError } from '../../api';

const MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. המסע לא הסתיים.',
  MISSION_ENDED: 'המסע כבר הסתיים. רעננו את המסך.',
  VALIDATION_ERROR: 'המיקום או הזמן אינם תקינים.',
  FORBIDDEN: 'אין הרשאה לסיים את המסע.',
  NOT_FOUND: 'המסע לא נמצא. רעננו את המסך.',
};

/** A Hebrew message for a failed end of the mission as located (UC-C16). */
export function endLocatedErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'המסע לא הסתיים. נסו שוב.';
}
