import { beforeEach, describe, expect, it } from 'vitest';
import { resolveThemeId, usePreferences } from '.';

describe('resolveThemeId', () => {
  it('follows the device by default: dark is night, light is day', () => {
    expect(resolveThemeId('system', 'dark')).toBe('night');
    expect(resolveThemeId('system', 'light')).toBe('day');
  });

  it('uses day when the device reports no scheme', () => {
    expect(resolveThemeId('system', null)).toBe('day');
    expect(resolveThemeId('system', undefined)).toBe('day');
  });

  it('lets an explicit choice override the device', () => {
    expect(resolveThemeId('day', 'dark')).toBe('day');
    expect(resolveThemeId('night', 'light')).toBe('night');
  });
});

describe('usePreferences', () => {
  beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

  it('starts by following the device', () => {
    expect(usePreferences.getState().themePreference).toBe('system');
  });

  it('remembers the chosen theme', () => {
    usePreferences.getState().setThemePreference('night');
    expect(usePreferences.getState().themePreference).toBe('night');
  });
});
