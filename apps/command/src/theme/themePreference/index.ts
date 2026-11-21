import { themeIds, type ThemeId } from '@trace/design';
import { choose } from '../../choose';

/** A theme, or `system` to follow the device's light/dark setting. */
export type ThemePreference = ThemeId | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', ...themeIds];

/** The preference saved on this device; `system` when nothing, or nothing valid, is saved. */
export const parseThemePreference = (stored: string | null): ThemePreference =>
  choose(THEME_PREFERENCES, stored, 'system');
