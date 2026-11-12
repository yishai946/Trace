import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedChoice } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';

const options = [
  { value: 'self', label: 'אני ראיתי' },
  { value: 'witness', label: 'עד ראייה' },
] as const;

afterEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('SegmentedChoice', () => {
  it('is a radio group named by its label, with the chosen option checked', () => {
    render(<SegmentedChoice label="מקור התצפית" options={options} value="self" onChange={() => {}} />, {
      wrapper: ThemeProvider,
    });
    const group = screen.getByRole('radiogroup', { name: 'מקור התצפית' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'אני ראיתי' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'עד ראייה' })).not.toBeChecked();
  });

  it('reports the option that is pressed', () => {
    const onChange = vi.fn();
    render(<SegmentedChoice label="מקור התצפית" options={options} value="self" onChange={onChange} />, {
      wrapper: ThemeProvider,
    });
    fireEvent.click(screen.getByRole('radio', { name: 'עד ראייה' }));
    expect(onChange).toHaveBeenCalledWith('witness');
  });

  it.each(['night', 'day'] as const)('raises the checked option in the %s theme', (id) => {
    usePreferences.setState({ themePreference: id });
    render(<SegmentedChoice label="מקור התצפית" options={options} value="self" onChange={() => {}} />, {
      wrapper: ThemeProvider,
    });
    expect(screen.getByRole('radio', { name: 'אני ראיתי' })).toHaveStyle({
      backgroundColor: themes[id].color.surfaceRaised,
    });
  });
});
