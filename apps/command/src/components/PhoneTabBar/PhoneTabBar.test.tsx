import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhoneTabBar } from '.';

describe('PhoneTabBar', () => {
  it('marks the current screen and moves to another', () => {
    const onChange = vi.fn();
    render(<PhoneTabBar view="board" onChange={onChange} />);

    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('button', { name: 'לוח' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'עוד' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('tab')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'עוד' }));
    expect(onChange).toHaveBeenCalledWith('more');
  });
});
