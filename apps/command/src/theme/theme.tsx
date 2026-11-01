import { themeIds, type ThemeId } from '@trace/design';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

const STORAGE_KEY = 'trace.theme';

/** A theme, or `system` to follow the device's light/dark setting. */
export type ThemePreference = ThemeId | 'system';

interface ThemeContextValue {
  /** The theme on screen. */
  theme: ThemeId;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'system' || (stored && (themeIds as readonly string[]).includes(stored))) {
      return stored as ThemePreference;
    }
  } catch {
    // Storage can be blocked; fall back to the device setting.
  }
  return 'system';
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

// matchMedia is missing in some environments (jsdom); treat them as dark, the console's default.
const darkQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null);

function subscribeToDevice(onChange: () => void) {
  const query = darkQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** The device's setting as a Trace Console theme: dark is night, light is day. */
function useDeviceTheme(): ThemeId {
  const dark = useSyncExternalStore(
    subscribeToDevice,
    () => darkQuery()?.matches ?? true,
    () => true,
  );
  return dark ? 'night' : 'day';
}

/** Applies the Trace Console theme (night/day) as `data-theme` on <html>, where tokens.css reads it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);
  const deviceTheme = useDeviceTheme();
  const theme = preference === 'system' ? deviceTheme : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not persisting is fine.
    }
  }, [preference]);

  return <ThemeContext value={{ theme, preference, setPreference }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
