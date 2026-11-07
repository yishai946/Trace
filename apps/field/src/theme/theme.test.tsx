import { themes } from '@trace/design';
import { act, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '.';
import { usePreferences } from '../state/preferences';

function ThemeName() {
  const { themeId, theme } = useTheme();
  return <Text style={{ color: theme.color.ink }}>{themeId}</Text>;
}

describe('ThemeProvider', () => {
  beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

  it('follows the device until the searcher chooses, then updates every consumer', () => {
    render(<ThemeName />, { wrapper: ThemeProvider });
    // jsdom reports a light device.
    expect(screen.getByText('day')).toHaveStyle({ color: themes.day.color.ink });

    act(() => usePreferences.getState().setThemePreference('night'));
    expect(screen.getByText('night')).toHaveStyle({ color: themes.night.color.ink });
  });

  it('refuses to be used outside the provider', () => {
    expect(() => render(<ThemeName />)).toThrow('useTheme must be used inside <ThemeProvider>');
  });
});
