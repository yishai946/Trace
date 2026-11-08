import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionTabBar } from '.';

describe('MissionTabBar', () => {
  it('is the main navigation and marks the current screen', () => {
    render(<MissionTabBar current="board" onNavigate={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'לוח' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'מחפשים' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'דיווחים' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('reports the screen the commander chose', () => {
    const onNavigate = vi.fn();
    render(<MissionTabBar current="board" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'דיווחים' }));
    expect(onNavigate).toHaveBeenCalledWith('reports');
  });
});
