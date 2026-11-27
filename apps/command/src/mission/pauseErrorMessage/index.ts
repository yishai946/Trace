import { ApiRequestError } from '../../api';

const MESSAGES: Partial<Record<ApiRequestError['code'], string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. מצב המסע לא השתנה.',
  MISSION_ENDED: 'המסע כבר הסתיים. רעננו את המסך.',
  FORBIDDEN: 'אין הרשאה להשהות או לחדש את המסע.',
  NOT_FOUND: 'המסע לא נמצא. רעננו את המסך.',
};

/** A Hebrew message for a failed pause or resume of the mission (UC-C15). */
export function pauseErrorMessage(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'מצב המסע לא השתנה. נסו שוב.';
}
