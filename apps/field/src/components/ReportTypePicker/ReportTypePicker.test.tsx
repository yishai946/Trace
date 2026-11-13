import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportTypePicker } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('ReportTypePicker', () => {
  it('offers the five categories in one radio group, none chosen at first', () => {
    render(<ReportTypePicker value={null} onChange={() => {}} />, { wrapper: ThemeProvider });
    const group = screen.getByRole('radiogroup', { name: 'קטגוריה' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'ממצא / רמז',
      'מפגע',
      'לא נגיש',
      'כללי',
      'הנעדר אותר, התראה קריטית למנהל, לא סוגר את המסע',
    ]);
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(0);
  });

  it('reports the pressed category and checks only the current one', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ReportTypePicker value={null} onChange={onChange} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('radio', { name: 'מפגע' }));
    expect(onChange).toHaveBeenCalledWith('hazard');

    rerender(<ReportTypePicker value="hazard" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'מפגע' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'כללי' })).toHaveAttribute('aria-checked', 'false');
  });

  it('explains what the located report does', () => {
    render(<ReportTypePicker value={null} onChange={() => {}} />, { wrapper: ThemeProvider });
    expect(screen.getByText('התראה קריטית למנהל, לא סוגר את המסע')).toBeInTheDocument();
  });

  it('shows the error under the group', () => {
    render(<ReportTypePicker value={null} onChange={() => {}} error="בחר קטגוריה." />, { wrapper: ThemeProvider });
    expect(screen.getByRole('alert')).toHaveTextContent('בחר קטגוריה.');
  });

  it.each(['night', 'day'] as const)('marks the chosen option with the %s accent border', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<ReportTypePicker value="finding" onChange={() => {}} />, { wrapper: ThemeProvider });
    expect(screen.getByRole('radio', { name: 'ממצא / רמז' })).toHaveStyle({ borderColor: themes[id].color.accent });
  });
});
