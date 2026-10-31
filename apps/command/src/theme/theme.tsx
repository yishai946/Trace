import { themeIds, type ThemeId } from '@trace/design';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'trace.theme';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (themeIds as readonly string[]).includes(stored)) return stored as ThemeId;
  } catch {
    // Storage can be blocked; fall back to the default theme.
  }
  return themeIds[0];
}

/** Applies the Trace Console theme (night/day) as `data-theme` on <html>, where tokens.css reads it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not persisting is fine.
    }
  }, [theme]);

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
