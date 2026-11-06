import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '.';
import { ThemeProvider } from '../../theme';

describe('Button', () => {
  it('is a button named by its label', () => {
    const onPress = vi.fn();
    render(<Button label="אמת והמשך" onPress={onPress} />, { wrapper: ThemeProvider });

    fireEvent.click(screen.getByRole('button', { name: 'אמת והמשך' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('takes a separate screen reader label when the visible label is not enough', () => {
    render(<Button label="SOS" accessibilityLabel="הפעל SOS" />, { wrapper: ThemeProvider });
    expect(screen.getByRole('button', { name: 'הפעל SOS' })).toBeInTheDocument();
  });

  it('says when it is disabled and ignores presses', () => {
    const onPress = vi.fn();
    render(<Button label="שלח" disabled onPress={onPress} />, { wrapper: ThemeProvider });

    const button = screen.getByRole('button', { name: 'שלח' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
