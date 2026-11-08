import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MissionLayout } from '.';
import type { MissionView } from '../MissionNav';

function Harness() {
  const [view, setView] = useState<MissionView>('map');
  return (
    <MissionLayout missionName="מסע 0412" view={view} onNavigate={setView} joinPanel={null}>
      {view === 'timeline' && <p>ציר הזמן</p>}
    </MissionLayout>
  );
}

describe('MissionLayout', () => {
  it('keeps the same navigation link, and its focus, when the view changes', () => {
    render(<Harness />);

    const timeline = screen.getByRole('link', { name: 'ציר זמן' });
    timeline.focus();
    fireEvent.click(timeline);
    expect(screen.getByText('ציר הזמן')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ציר זמן' })).toBe(timeline);
    expect(document.activeElement).toBe(timeline);
    expect(timeline.getAttribute('aria-current')).toBe('page');

    const map = screen.getByRole('link', { name: 'לוח מבצעי' });
    map.focus();
    fireEvent.click(map);
    expect(screen.getByRole('link', { name: 'לוח מבצעי' })).toBe(map);
    expect(document.activeElement).toBe(map);
    expect(map.getAttribute('aria-current')).toBe('page');
  });
});
