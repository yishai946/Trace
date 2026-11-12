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

  it('shows when a searcher has no GPS, and since when', () => {
    const lost = '2026-10-03T12:30:00.000Z';
    render(<SearchersPage {...props({ participants: [{ ...dana, gpsUnavailableSince: lost }] })} />);
    const row = within(rows()[0] as HTMLElement);
    expect(row.getByText(/GPS לא זמין/).textContent?.trim()).toBe(`GPS לא זמין מ-${timeLabel(lost)}`);
    // The last update stays: when the searcher was last seen matters most now (decision 44).
    expect(row.getByText(timeLabel(dana.positionAt ?? ''))).toBeTruthy();
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

describe('ending a participation (UC-C18)', () => {
  it('asks to confirm, then ends it', () => {
    const onEnd = vi.fn();
    render(<SearchersPage {...props({ participants: [dana], onEnd })} />);

    fireEvent.click(screen.getByRole('button', { name: 'סיים השתתפות של דנה כהן…' }));
    expect(onEnd).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'אישור סיום השתתפות של דנה כהן' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'סיים השתתפות' }));
    expect(onEnd).toHaveBeenCalledWith(dana.id);
  });

  it('is disabled when it cannot be done', () => {
    render(<SearchersPage {...props({ participants: [dana] })} />);
    expect(screen.getByRole('button', { name: 'סיים השתתפות של דנה כהן…' })).toBeDisabled();
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

describe('assigning from the pool (UC-C09)', () => {
  const polygonB = { ...polygonA, id: '00000000-0000-4000-8000-0000000000b2', name: 'פוליגון B' };

  it('assigns a waiting searcher to a polygon chosen from the menu', () => {
    const onAssign = vi.fn();
    render(<SearchersPage {...props({ participants: [michal], polygons: [polygonA, polygonB], onAssign })} />);

    fireEvent.click(screen.getByRole('button', { name: 'שבץ את מיכל פרץ' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'פוליגון B' }));
    expect(onAssign).toHaveBeenCalledWith(michal.id, polygonB.id);
  });

  it('offers to move an assigned searcher to the other polygons only', () => {
    render(<SearchersPage {...props({ participants: [dana], polygons: [polygonA, polygonB], onAssign: vi.fn() })} />);

    fireEvent.click(screen.getByRole('button', { name: 'העבר את דנה כהן' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['פוליגון B']);
  });

  it('waits while an assignment is being saved', () => {
    render(<SearchersPage {...props({ participants: [michal], onAssign: vi.fn(), assigning: true })} />);
    expect(screen.getByRole('button', { name: 'שבץ את מיכל פרץ' })).toBeDisabled();
  });

  it('disables assigning when it cannot be done, and shows why it failed', () => {
    render(<SearchersPage {...props({ participants: [michal], assignError: 'השיבוץ לא נשמר. נסו שוב.' })} />);
    expect(screen.getByRole('button', { name: 'שבץ את מיכל פרץ' })).toBeDisabled();
    expect(screen.getByRole('alert').textContent).toBe('השיבוץ לא נשמר. נסו שוב.');
  });

  it('puts a call link first in each row, before the assign button', () => {
    render(<SearchersPage {...props({ participants: [dana, michal] })} />);
    for (const p of [dana, michal]) {
      const row = rows().find((r) => within(r).queryByText(p.name)) as HTMLElement;
      const call = within(row).getByRole('link', { name: `התקשר ל${p.name}` });
      expect(call.getAttribute('href')).toBe(`tel:${p.phone}`);
      const assign = within(row).getByRole('button', { name: /את / });
      expect(call.compareDocumentPosition(assign) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(dana.phone).toBe('+972526114085');
  });

  it('disables the call link of a searcher without a phone only', () => {
    render(<SearchersPage {...props({ participants: [{ ...dana, phone: '' }, michal] })} />);
    const noPhone = screen.getByRole('link', { name: `התקשר ל${dana.name}` });
    expect(noPhone.getAttribute('aria-disabled')).toBe('true');
    expect(noPhone.getAttribute('href')).toBeNull();
    const other = screen.getByRole('link', { name: `התקשר ל${michal.name}` });
    expect(other.getAttribute('aria-disabled')).toBeNull();
    expect(other.getAttribute('href')).toBe(`tel:${michal.phone}`);
  });
});
