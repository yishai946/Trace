import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '.';

describe('Checkbox', () => {
  it('is a checkbox with its label, and reports a toggle', () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>עדכן את המחפשים</Checkbox>);
    const box = screen.getByRole('checkbox', { name: 'עדכן את המחפשים' });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows it is selected', () => {
    render(<Checkbox isSelected>עדכן את המחפשים</Checkbox>);
    expect(screen.getByRole('checkbox', { name: 'עדכן את המחפשים' })).toBeChecked();
  });

  it('cannot be used when disabled', () => {
    render(<Checkbox isDisabled>עדכן את המחפשים</Checkbox>);
    expect(screen.getByRole('checkbox', { name: 'עדכן את המחפשים' })).toBeDisabled();
  });
});
