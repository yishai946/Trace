import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OutsidePolygonAlert } from '.';
import type { OutsideSearcher } from '../outsideSearchers';

const dana: OutsideSearcher = {
  participantId: '00000000-0000-4000-8000-000000000004',
  callsign: 4,
  name: 'דנה כהן',
  polygonName: 'ואדי צפוני',
  meters: 80,
  since: '2026-10-03T13:55:00.000Z',
};
const alon: OutsideSearcher = {
  ...dana,
  participantId: '00000000-0000-4000-8000-000000000007',
  callsign: 7,
  name: 'אלון',
};

describe('OutsidePolygonAlert', () => {
  it('shows nothing while everyone is inside', () => {
    const { container } = render(<OutsidePolygonAlert searchers={[]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns who is outside which polygon, how far and since when', () => {
    render(<OutsidePolygonAlert searchers={[dana]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'אזהרה: מחפש מחוץ לפוליגון' });
    expect(within(alert).getByText('אזהרה')).toBeTruthy();
    expect(within(alert).getByText('04')).toBeTruthy();
    expect(alert.textContent).toContain('דנה כהן מחוץ ל');
    expect(alert.textContent).toContain('ואדי צפוני, 80 מ׳ מהגבול, מאז');
    expect(within(alert).getByText('16:55')).toBeTruthy();
  });

  it('counts the searchers when several are outside and shows the one outside the longest', () => {
    render(<OutsidePolygonAlert searchers={[dana, alon]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'אזהרה: מחפש מחוץ לפוליגון' });
    expect(within(alert).getByText('אזהרה · 2')).toBeTruthy();
    expect(within(alert).getByText('04')).toBeTruthy();
  });

  it('opens the searcher', () => {
    const onOpen = vi.fn();
    render(<OutsidePolygonAlert searchers={[dana]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }));
    expect(onOpen).toHaveBeenCalledWith(dana.participantId);
  });
});
