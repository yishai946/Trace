import { describe, expect, it } from 'vitest';
import { formatOpened } from '.';

describe('formatOpened', () => {
  const now = new Date(2026, 10, 1, 18, 0);

  it('reads today and yesterday by name, other days by date', () => {
    expect(formatOpened(new Date(2026, 10, 1, 11, 16).toISOString(), now)).toBe('היום 11:16');
    expect(formatOpened(new Date(2026, 9, 31, 22, 40).toISOString(), now)).toBe('אתמול 22:40');
    expect(formatOpened(new Date(2026, 9, 1, 14, 5).toISOString(), now)).toBe('01.10, 14:05');
    expect(formatOpened(new Date(2025, 9, 1, 14, 5).toISOString(), now)).toBe('01.10.2025');
  });
});
