import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../api';
import { rallyErrorMessage } from '.';

describe('rallyErrorMessage', () => {
  it.each([
    ['NETWORK_ERROR', 'אין חיבור לשרת. נקודת הכינוס לא נשמרה.'],
    ['MISSION_ENDED', 'אי אפשר לשנות נקודת כינוס במסע שהסתיים.'],
    ['VALIDATION_ERROR', 'הקואורדינטות אינן תקינות.'],
    ['FORBIDDEN', 'המסע לא זמין לשינוי. רעננו את המסך.'],
    ['NOT_FOUND', 'המסע לא זמין לשינוי. רעננו את המסך.'],
    ['INTERNAL_ERROR', 'נקודת הכינוס לא נשמרה. נסו שוב.'],
  ] as const)('explains %s', (code, message) => {
    expect(rallyErrorMessage(new ApiRequestError(400, code, 'x'))).toBe(message);
  });

  it('has a general message for anything else', () => {
    expect(rallyErrorMessage(new Error('boom'))).toBe('נקודת הכינוס לא נשמרה. נסו שוב.');
  });
});
