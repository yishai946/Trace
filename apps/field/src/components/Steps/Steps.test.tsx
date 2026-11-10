import { themes } from '@trace/design';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Steps } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('Steps', () => {
  it('announces the current step', () => {
    render(<Steps steps={['טלפון', 'אימות']} current={1} />, { wrapper: ThemeProvider });
    expect(screen.getByLabelText('שלב 2 מתוך 2, אימות')).toBeInTheDocument();
  });

  it.each(['night', 'day'] as const)('fills the current marker with the accent in %s', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<Steps steps={['טלפון', 'אימות']} current={1} />, { wrapper: ThemeProvider });
    expect(screen.getByText('2').parentElement).toHaveStyle({ backgroundColor: themes[id].color.accent });
  });
});
