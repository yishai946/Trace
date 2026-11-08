import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateTimeField } from '.';

describe('DateTimeField', () => {
  it('shows the value and reports changes as YYYY-MM-DDTHH:mm', () => {
    const onChange = vi.fn();
    render(<DateTimeField label="זמן היעלמות" value="2026-10-03T11:20" onChange={onChange} />);
    const minute = screen.getAllByRole('spinbutton').find((s) => s.getAttribute('aria-valuenow') === '20');
    if (!minute) throw new Error('No minute segment');
    fireEvent.keyDown(minute, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith('2026-10-03T11:21');
  });

  it('shows an empty field for an empty value', () => {
    render(<DateTimeField label="זמן היעלמות" value="" onChange={() => {}} />);
    expect(screen.getAllByRole('spinbutton').every((s) => !s.hasAttribute('aria-valuenow'))).toBe(true);
  });

  it('cannot be changed when read only', () => {
    const onChange = vi.fn();
    render(<DateTimeField label="זמן היעלמות" value="2026-10-03T11:20" onChange={onChange} isReadOnly />);
    const minute = screen.getAllByRole('spinbutton').find((s) => s.getAttribute('aria-valuenow') === '20');
    if (!minute) throw new Error('No minute segment');
    fireEvent.keyDown(minute, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
