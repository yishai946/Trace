import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeChoice } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

describe('ThemeChoice', () => {
  beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

  it('offers day, night and the device setting, following the device by default', () => {
    render(<ThemeChoice />, { wrapper: ThemeProvider });

    expect(screen.getByRole('radiogroup', { name: 'ערכת צבעים' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'יום' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'לילה' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'לפי המכשיר' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches the theme for the whole app', () => {
    render(<ThemeChoice />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('radio', { name: 'לילה' }));
    expect(usePreferences.getState().themePreference).toBe('night');
    expect(screen.getByRole('radio', { name: 'לילה' })).toHaveAttribute('aria-checked', 'true');
  });
});
