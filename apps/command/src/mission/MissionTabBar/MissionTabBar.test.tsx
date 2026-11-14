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

  it('TB1: counts the New reports on the reports item', () => {
    render(<MissionTabBar current="board" onNavigate={vi.fn()} counts={{ reports: 3 }} />);
    const link = screen.getByRole('link', { name: 'דיווחים, 3 חדשים' });
    expect(link).toHaveTextContent('3');
  });

  it('TB2: shows no badge without New reports', () => {
    const { unmount } = render(<MissionTabBar current="board" onNavigate={vi.fn()} counts={{ reports: 0 }} />);
    expect(screen.getByRole('link', { name: 'דיווחים' })).not.toHaveTextContent('0');
    unmount();
    render(<MissionTabBar current="board" onNavigate={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'דיווחים' }).querySelector('span')).toBeNull();
  });
});
