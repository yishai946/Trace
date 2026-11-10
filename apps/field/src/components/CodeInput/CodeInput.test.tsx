import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeInput } from '.';
import { ThemeProvider } from '../../theme';

const label = 'קוד אימות, 6 ספרות';

function setup(props: Partial<Parameters<typeof CodeInput>[0]> = {}) {
  const onChange = vi.fn();
  const onComplete = vi.fn();
  render(<CodeInput value="" onChange={onChange} onComplete={onComplete} {...props} />, { wrapper: ThemeProvider });
  return { onChange, onComplete };
}

describe('CodeInput', () => {
  it('is one input named by the code length', () => {
    setup();
    expect(screen.getAllByLabelText(label)).toHaveLength(1);
  });

  it('keeps digits only', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(label), { target: { value: '12a3' } });
    expect(onChange).toHaveBeenCalledWith('123');
  });

  it('completes at six digits and not before', () => {
    const { onComplete } = setup();
    fireEvent.change(screen.getByLabelText(label), { target: { value: '12345' } });
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(label), { target: { value: '123456' } });
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('marks the code invalid', () => {
    setup({ invalid: true });
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows each typed digit in its cell', () => {
    setup({ value: '4817' });
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
