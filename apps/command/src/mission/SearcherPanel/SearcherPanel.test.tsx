import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Participant } from '@trace/schemas';
import { SearcherPanel } from '.';
import { participants } from '../fixtures';

const searcher: Participant = {
  ...participants[0]!,
  position: [35.0166, 31.7471],
  lastUpdateAt: '2026-10-03T13:58:41.000Z',
  battery: { level: 77, measuredAt: '2026-10-03T13:58:00.000Z' },
};

const props = {
  polygonName: 'ואדי צפוני',
  routeMeters: 3800,
  routeFailed: false,
  onRetryRoute: vi.fn(),
  onClose: vi.fn(),
};

const field = (name: string) => within(screen.getByText(name, { selector: 'dt' }).parentElement as HTMLElement);

describe('SearcherPanel', () => {
  it('shows the seven fields of UC-C10', () => {
    render(<SearcherPanel searcher={searcher} {...props} />);
    expect(screen.getByRole('region', { name: 'פרטי מחפש' })).toBeTruthy();
    expect(screen.getByText('דנה כהן')).toBeTruthy();
    expect(field('מיקום נוכחי').getByText('31.7471, 35.0166')).toBeTruthy();
    expect(field('פוליגון').getByText('ואדי צפוני')).toBeTruthy();
    expect(field('סטטוס').getByText('בחיפוש')).toBeTruthy();
    expect(field('מסלול').getByText('3.8 ק״מ')).toBeTruthy();
    expect(field('עדכון אחרון').getByText('16:58')).toBeTruthy();
    expect(field('קישוריות').getByText('מקוון')).toBeTruthy();
    expect(field('סוללה').getByText('77%')).toBeTruthy();
  });

  it('shows a searcher with no report yet without inventing values', () => {
    const fresh = { ...searcher, position: null, positionAt: null, lastUpdateAt: null, battery: null, offline: true };
    render(<SearcherPanel searcher={fresh} {...props} polygonName={null} routeMeters={0} />);
    expect(field('מיקום נוכחי').getByText('אין עדיין')).toBeTruthy();
    expect(field('פוליגון').getByText('—')).toBeTruthy();
    expect(field('עדכון אחרון').getByText('אין עדיין')).toBeTruthy();
    expect(field('קישוריות').getByText('לא מקוון')).toBeTruthy();
    expect(field('סוללה').getByText('לא דווחה')).toBeTruthy();
    expect(field('מסלול').getByText('אין עדיין')).toBeTruthy();
  });

  it('shows meters for a short route', () => {
    render(<SearcherPanel searcher={searcher} {...props} routeMeters={420} />);
    expect(field('מסלול').getByText('420 מ׳')).toBeTruthy();
  });

  it('says when GPS is unavailable', () => {
    const noGps = { ...searcher, gpsUnavailableSince: '2026-10-03T13:50:00.000Z' };
    render(<SearcherPanel searcher={noGps} {...props} />);
    expect(screen.getByRole('status').textContent).toContain('GPS לא זמין מאז 16:50');
  });

  it('shows the route loading and failing, and retries', () => {
    const { rerender } = render(<SearcherPanel searcher={searcher} {...props} routeMeters={null} />);
    expect(field('מסלול').getByText('טוען…')).toBeTruthy();
    rerender(<SearcherPanel searcher={searcher} {...props} routeMeters={null} routeFailed />);
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(props.onRetryRoute).toHaveBeenCalledOnce();
  });

  it('calls the searcher and closes', () => {
    render(<SearcherPanel searcher={searcher} {...props} />);
    expect(screen.getByRole('link', { name: /התקשר/ }).getAttribute('href')).toBe('tel:+972526114085');
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
