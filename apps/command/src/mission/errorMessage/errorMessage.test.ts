import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../api';
import { errorMessage } from '.';

describe('errorMessage', () => {
  it('names the Offline searchers that block a boundary change', () => {
    const details = {
      searchers: [{ participantId: '4f1d6c0e-2b7a-4c52-9a3e-0d1b5a7c9e21', callsign: 4, name: 'דנה' }],
    };
    const error = new ApiRequestError(409, 'SEARCHER_OFFLINE', 'blocked', details);
    expect(errorMessage(error)).toContain('דנה (4)');
    expect(errorMessage(error)).toContain('Offline');
  });

  it('falls back to a generic block message without details', () => {
    expect(errorMessage(new ApiRequestError(409, 'SEARCHER_OFFLINE', 'blocked'))).toContain('Offline');
  });

  it('keeps the generic message for other errors', () => {
    expect(errorMessage(new Error('x'))).toBe('השינוי לא נשמר. נסו שוב.');
  });
});
