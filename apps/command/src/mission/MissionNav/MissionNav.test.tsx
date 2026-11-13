import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MissionNav } from '.';

describe('MissionNav', () => {
  it('shows the mission name and marks the current view', () => {
    render(<MissionNav missionName="מסע 0412" view="timeline" onNavigate={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'ניווט מסע' }).textContent).toContain('מסע 0412');
    expect(screen.getByRole('link', { name: 'ציר זמן' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'לוח מבצעי' }).getAttribute('aria-current')).toBeNull();
  });

  it('goes to the Timeline, and back to the map', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<MissionNav missionName="מסע 0412" view="map" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'ציר זמן' }));
    expect(onNavigate).toHaveBeenLastCalledWith('timeline');

    rerender(<MissionNav missionName="מסע 0412" view="timeline" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'לוח מבצעי' }));
    expect(onNavigate).toHaveBeenLastCalledWith('map');
  });

  it('shows הודעות and marks it current when open', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<MissionNav missionName="מסע 0412" view="map" onNavigate={onNavigate} />);
    expect(screen.getByRole('link', { name: 'הודעות' }).getAttribute('aria-current')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'הודעות' }));
    expect(onNavigate).toHaveBeenLastCalledWith('messages');

    rerender(<MissionNav missionName="מסע 0412" view="messages" onNavigate={onNavigate} />);
    expect(screen.getByRole('link', { name: 'הודעות' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows דיווחים between the searchers and the messages, and opens it', () => {
    const onNavigate = vi.fn();
    render(<MissionNav missionName="מסע 0412" view="map" onNavigate={onNavigate} />);
    const names = screen.getAllByRole('link').map((link) => link.textContent);
    expect(names).toEqual(['לוח מבצעי', 'מחפשים', 'דיווחים', 'הודעות', 'ציר זמן']);
    fireEvent.click(screen.getByRole('link', { name: 'דיווחים' }));
    expect(onNavigate).toHaveBeenLastCalledWith('reports');
  });

  it('shows a count only when it is above zero, and names it for screen readers', () => {
    const { rerender } = render(
      <MissionNav missionName="מסע 0412" view="map" onNavigate={vi.fn()} counts={{ reports: 3 }} />,
    );
    const link = screen.getByRole('link', { name: 'דיווחים, 3 חדשים' });
    expect(link.textContent).toContain('3');
    rerender(<MissionNav missionName="מסע 0412" view="map" onNavigate={vi.fn()} counts={{ reports: 0 }} />);
    expect(screen.getByRole('link', { name: 'דיווחים' }).textContent).toBe('דיווחים');
  });
});
