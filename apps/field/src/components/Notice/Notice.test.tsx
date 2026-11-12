import { themes } from '@trace/design';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Notice } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('Notice', () => {
  it('shows its text with a neutral border', () => {
    render(<Notice icon="wifiOff">הדיווח נשמר במכשיר.</Notice>, { wrapper: ThemeProvider });
    expect(screen.getByText('הדיווח נשמר במכשיר.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('הדיווח נשמר במכשיר.').parentElement).toHaveStyle({
      borderColor: themes.day.color.border,
    });
  });

  it.each(['night', 'day'] as const)('is a warning with the %s warning border, announced when live', (id) => {
    usePreferences.setState({ themePreference: id });
    render(
      <Notice tone="warn" live>
        הדיווח לא הגיע.
      </Notice>,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByRole('alert')).toHaveStyle({ borderColor: themes[id].color.warning });
  });
});
