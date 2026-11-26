import { describe, expect, it } from 'vitest';
import { FAR_FROM_RALLY_POINT_METERS, rallyPointAdvice } from '.';

describe('rallyPointAdvice (UC-F15, decision 30)', () => {
  it('recommends reaching the Rally Point only when the searcher is farther than the limit', () => {
    expect(rallyPointAdvice(0)).toBe('near');
    expect(rallyPointAdvice(FAR_FROM_RALLY_POINT_METERS)).toBe('near');
    expect(rallyPointAdvice(FAR_FROM_RALLY_POINT_METERS + 1)).toBe('far');
  });

  it('cannot tell without a position, and still never blocks', () => {
    expect(rallyPointAdvice(null)).toBe('unknown');
  });
});
