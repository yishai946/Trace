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

  it('TB3: opens SOS and counts the active ones on its item', () => {
    const onNavigate = vi.fn();
    render(<MissionTabBar current="board" onNavigate={onNavigate} counts={{ sos: 1 }} />);
    const link = screen.getByRole('link', { name: 'SOS, 1 פעילות' });
    expect(link).toHaveTextContent('1');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('sos');
  });

  it('TB4: lists five items, opens Messages and shows no count on it', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<MissionTabBar current="board" onNavigate={onNavigate} />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'לוח',
      'מחפשים',
      'דיווחים',
      'הודעות',
      'SOS',
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'הודעות' }));
    expect(onNavigate).toHaveBeenCalledWith('messages');

    rerender(<MissionTabBar current="messages" onNavigate={onNavigate} counts={{ reports: 3 }} />);
    const link = screen.getByRole('link', { name: 'הודעות' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).not.toHaveTextContent(/\d/);
  });
});
