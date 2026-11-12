import { describe, expect, it } from 'vitest';
import { SOS_STATUSES, canActivateSos, canCloseSos } from '.';

describe('SOS_STATUSES', () => {
  it('has the two states of an SOS', () => {
    expect(SOS_STATUSES).toEqual(['active', 'closed']);
  });
});

describe('canActivateSos', () => {
  it('lets a searcher activate until their activity ended', () => {
    expect(canActivateSos('assigned')).toBe(true);
    expect(canActivateSos('available')).toBe(true);
    expect(canActivateSos('ended')).toBe(false);
  });
});

describe('canCloseSos', () => {
  it('lets the commander and the sender close it', () => {
    expect(canCloseSos({ role: 'commander', isSender: false })).toBe(true);
    expect(canCloseSos({ role: 'searcher', isSender: true })).toBe(true);
  });

  it('refuses another searcher', () => {
    expect(canCloseSos({ role: 'searcher', isSender: false })).toBe(false);
  });
});
