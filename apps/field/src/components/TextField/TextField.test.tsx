import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '.';
import { ThemeProvider } from '../../theme';

describe('TextField', () => {
  it('labels the input and reports typing', () => {
    const onChangeText = vi.fn();
    render(<TextField label="מספר טלפון" value="" onChangeText={onChangeText} />, { wrapper: ThemeProvider });

    fireEvent.change(screen.getByLabelText('מספר טלפון'), { target: { value: '050' } });
    expect(onChangeText).toHaveBeenCalledWith('050');
  });

  it('marks the input invalid with one alert under it', () => {
    render(<TextField label="שם מלא" value="" onChangeText={() => {}} error="הזן שם." />, { wrapper: ThemeProvider });

    expect(screen.getByLabelText('שם מלא')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('הזן שם.');
  });

  it('shows no alert without an error', () => {
    render(<TextField label="שם מלא" value="" onChangeText={() => {}} />, { wrapper: ThemeProvider });

    expect(screen.getByLabelText('שם מלא')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('writes a left-to-right value at the end of the right-to-left field', () => {
    render(<TextField label="מספר טלפון" ltr value="" onChangeText={() => {}} />, { wrapper: ThemeProvider });
    expect(screen.getByLabelText('מספר טלפון')).toHaveStyle({ textAlign: 'right' });
  });

  it('makes a multiline field taller than a single line', () => {
    render(<TextField label="תיאור קצר" multiline value="" onChangeText={() => {}} />, { wrapper: ThemeProvider });
    expect(screen.getByLabelText('תיאור קצר').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('תיאור קצר')).toHaveStyle({ minHeight: '66px' });
  });
});
