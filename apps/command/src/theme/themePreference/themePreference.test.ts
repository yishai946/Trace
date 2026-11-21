import { themeIds } from '@trace/design';
import { describe, expect, it } from 'vitest';
import { parseThemePreference, THEME_PREFERENCES } from '.';

describe('parseThemePreference', () => {
  it.each(['system', 'night', 'day'] as const)('parses %s to itself', (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  it.each([null, '', 'dark', 'NIGHT'])('falls back to system for %j', (value) => {
    expect(parseThemePreference(value)).toBe('system');
  });

  it('lists system and every theme', () => {
    expect(THEME_PREFERENCES).toContain('system');
    for (const id of themeIds) expect(THEME_PREFERENCES).toContain(id);
  });
});
