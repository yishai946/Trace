import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '.';
import { ThemeProvider } from '../../theme';
import { pendingTokens } from '../../theme/pending';

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

  it('is a taller text area when multiline', () => {
    render(<TextField label="פירוט" multiline value="" onChangeText={() => {}} />, { wrapper: ThemeProvider });
    const input = screen.getByLabelText('פירוט');
    expect(input.tagName).toBe('TEXTAREA');
    expect(input).toHaveStyle({ minHeight: `${pendingTokens.reportTextMinH}px` });
  });
});
