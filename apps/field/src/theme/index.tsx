import { themes, type Theme, type ThemeId } from '@trace/design';
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeId, usePreferences } from '../state/preferences';

interface ThemeContextValue {
  themeId: ThemeId;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Trace Console theme for React Native. Follows the device (dark is night, light is day) until the searcher picks
 * "יום" or "לילה", e.g. day in direct sunlight. Every screen and the map read it from here, so a change applies at once.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const preference = usePreferences((s) => s.themePreference);
  const themeId = resolveThemeId(preference, scheme);

  return <ThemeContext value={{ themeId, theme: themes[themeId] }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
