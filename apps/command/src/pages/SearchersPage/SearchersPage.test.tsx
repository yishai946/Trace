import type { Participant } from '@trace/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchersPage, statusLabel, type SearchersPageProps } from '.';
import { participants, polygonA } from '../../mission/fixtures';
import { timeLabel } from '../../mission/timeLabel';

const props = (overrides: Partial<SearchersPageProps> = {}): SearchersPageProps => ({
  participants,
  polygons: [polygonA],
  loadFailed: false,
  onRetry: vi.fn(),
  ...overrides,
});
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const [dana, michal] = participants as [Participant, Participant];

describe('SearchersPage', () => {
  it('lists the searchers with name, phone, state, polygon and last update', () => {
    render(<SearchersPage {...props({ participants: [dana, michal] })} />);

    const [second, first] = rows() as [HTMLElement, HTMLElement];
    expect(within(first).getByText('04')).toBeTruthy();
    expect(within(first).getByText('דנה כהן')).toBeTruthy();
    expect(within(first).getByRole('link', { name: '052-611-4085' }).getAttribute('href')).toBe('tel:+972526114085');
    expect(within(first).getByText('בחיפוש')).toBeTruthy();
    expect(within(first).getByText(polygonA.name)).toBeTruthy();
    expect(within(first).getByText(timeLabel(dana.positionAt ?? ''))).toBeTruthy();
    expect(within(second).getByText('זמין')).toBeTruthy();
    expect(within(second).getByText('אין עדיין')).toBeTruthy();
    expect(screen.getByText('2 במסע, 1 ממתינים לשיבוץ')).toBeTruthy();
  });

  it('puts waiting searchers first, then assigned, then those searching, each by callsign', () => {
    const at = (callsign: number, status: Participant['status'], taskStatus: Participant['taskStatus']) => ({
      ...dana,
      id: `00000000-0000-4000-8000-0000000000${String(callsign).padStart(2, '0')}`,
      callsign,
      status,
      taskStatus,
    });
    render(
      <SearchersPage
        {...props({
          participants: [
            at(2, 'assigned', 'searching'),
            at(18, 'available', null),
            at(10, 'assigned', 'ready'),
            at(13, 'available', null),
          ],
        })}
      />,
    );
    expect(rows().map((row) => within(row).getAllByText(/^\d\d$/)[0]?.textContent)).toEqual(['13', '18', '10', '02']);
  });

  it('leaves out searchers who ended their activity', () => {
    render(<SearchersPage {...props({ participants: [dana, { ...michal, status: 'ended' }] })} />);
    expect(rows()).toHaveLength(1);
  });

  it('says so before anyone joined', () => {
    render(<SearchersPage {...props({ participants: [] })} />);
    expect(screen.getByText(/עוד לא הצטרפו מחפשים/)).toBeTruthy();
  });

  it('shows loading, then a retry when loading failed', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<SearchersPage {...props({ participants: undefined })} />);
    expect(screen.getByText('טוען מחפשים…')).toBeTruthy();

    rerender(<SearchersPage {...props({ participants: undefined, loadFailed: true, onRetry })} />);
    expect(screen.getByRole('alert').textContent).toBe('לא ניתן לטעון מחפשים מהשרת.');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('statusLabel', () => {
  it('words every participation and task state', () => {
    expect(statusLabel({ status: 'available', taskStatus: null })).toBe('זמין');
    expect(statusLabel({ status: 'assigned', taskStatus: 'ready' })).toBe('משובץ');
    expect(statusLabel({ status: 'assigned', taskStatus: 'searching' })).toBe('בחיפוש');
    expect(statusLabel({ status: 'assigned', taskStatus: 'paused' })).toBe('מושהה');
    expect(statusLabel({ status: 'assigned', taskStatus: 'finished' })).toBe('משובץ');
    expect(statusLabel({ status: 'ended', taskStatus: null })).toBe('סיים');
  });
});
