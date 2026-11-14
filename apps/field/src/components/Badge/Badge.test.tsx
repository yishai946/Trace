import { themes } from '@trace/design';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Badge } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('Badge', () => {
  it('shows its word', () => {
    render(<Badge label="שלי" />, { wrapper: ThemeProvider });
    expect(screen.getByText('שלי')).toBeInTheDocument();
  });

  it('draws an icon before the word only when asked', () => {
    const { container, rerender } = render(<Badge label="נשלח" />, { wrapper: ThemeProvider });
    expect(container.querySelector('svg')).toBeNull();
    rerender(<Badge label="נשלח" icon="check" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('נשלח')).toBeInTheDocument();
  });

  it.each(['night', 'day'] as const)('colors the word by its tone in the %s theme', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<Badge label="ממתין" tone="warn" />, { wrapper: ThemeProvider });
    expect(screen.getByText('ממתין')).toHaveStyle({ color: themes[id].color.warning });
  });
});
