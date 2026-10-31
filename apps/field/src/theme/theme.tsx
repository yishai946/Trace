import { themes, type Theme, type ThemeId } from '@trace/design';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeContextValue {
  themeId: ThemeId;
  theme: Theme;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Trace Console theme for React Native. Defaults to the device setting (dark -> night, light -> day);
 * the searcher can switch manually, e.g. to `day` in direct sunlight.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [override, setThemeId] = useState<ThemeId | null>(null);
  const themeId: ThemeId = override ?? (scheme === 'dark' ? 'night' : 'day');

  return <ThemeContext value={{ themeId, theme: themes[themeId], setThemeId }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
