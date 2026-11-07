import type { ThemeId } from '@trace/design';
import type { ColorSchemeName } from 'react-native';
import { create } from 'zustand';

/** "לפי המכשיר" (`system`) is the default; the searcher can pin day or night. */
export type ThemePreference = 'system' | ThemeId;

interface PreferencesState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

/** Local, per-device settings of the searcher. */
export const usePreferences = create<PreferencesState>()((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));

export function resolveThemeId(preference: ThemePreference, scheme: ColorSchemeName | null | undefined): ThemeId {
  if (preference !== 'system') return preference;
  return scheme === 'dark' ? 'night' : 'day';
}
