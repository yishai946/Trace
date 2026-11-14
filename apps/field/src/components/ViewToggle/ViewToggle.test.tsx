import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewToggle } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('ViewToggle', () => {
  it('offers the list and the map as two named radios, checked by the value', () => {
    render(<ViewToggle value="list" onChange={() => undefined} />, { wrapper: ThemeProvider });
    expect(screen.getByRole('radiogroup', { name: 'תצוגה' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'רשימה' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'מפה' })).toHaveAttribute('aria-checked', 'false');
  });

  it('asks for the other view when it is pressed', () => {
    const onChange = vi.fn();
    render(<ViewToggle value="list" onChange={onChange} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('radio', { name: 'מפה' }));
    expect(onChange).toHaveBeenCalledWith('map');
  });

  it.each(['night', 'day'] as const)('raises the checked segment in the %s theme', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<ViewToggle value="map" onChange={() => undefined} />, { wrapper: ThemeProvider });
    expect(screen.getByRole('radio', { name: 'מפה' })).toHaveStyle({ backgroundColor: themes[id].color.surfaceRaised });
  });
});
