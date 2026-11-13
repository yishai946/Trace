import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lkps,
  mission,
  participants,
  polygonA,
  reportFinding,
  reportHazard,
  reportLocated,
  reports,
} from '../../mission/fixtures';
import { ReportsPage, type ReportsPageProps } from '.';

// The map needs WebGL: a stand-in that lets a test click a report symbol.
const mapProps = vi.hoisted(() => ({
  current: null as null | { onPointSelect?: (t: { kind: 'report'; id: string }) => void },
}));
vi.mock('../../map/MissionMap', () => ({
  MissionMap: (props: { onPointSelect?: (t: { kind: 'report'; id: string }) => void }) => {
    mapProps.current = props;
    return <div data-testid="map" />;
  },
}));

const base: ReportsPageProps = {
  reports,
  loadFailed: false,
  onRetry: vi.fn(),
  mission,
  polygons: [polygonA],
  participants,
  sightings: [],
  lkps,
  provider: {} as ReportsPageProps['provider'],
  themeId: 'night',
  selectedId: null,
  onSelect: vi.fn(),
  onHandle: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  busy: false,
  error: null,
  ended: false,
};

/** Holds the selection the way the console does, so choosing a row opens it. */
function Harness(props: Partial<ReportsPageProps>) {
  const [selectedId, setSelectedId] = useState<string | null>(props.selectedId ?? null);
  return <ReportsPage {...base} {...props} selectedId={selectedId} onSelect={setSelectedId} />;
}
const renderPage = (props: Partial<ReportsPageProps> = {}) => render(<Harness {...props} />);
const inspector = () => screen.getByRole('complementary', { name: 'פרטי דיווח' });
const list = () => screen.getByRole('region', { name: 'רשימת דיווחים' });

beforeEach(() => vi.clearAllMocks());

describe('ReportsPage', () => {
  it('RP1: lists the reports newest first with their meta and status badges, and counts them', () => {
    renderPage();
    const items = within(list()).getAllByRole('link');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('הנעדר אותר');
    expect(items[0]?.textContent).toContain('הנעדר אותר, 02 שחר מור, ואדי צפוני, 16:51');
    expect(items[0]?.textContent).toContain('חדש');
    expect(items[1]?.textContent).toContain('כפפה אפורה ליד השביל');
    expect(items[2]?.textContent).toContain('מדרון חלק');
    expect(items[2]?.textContent).toContain('מפגע, 09 מיכל פרץ, ללא פוליגון, 16:31');
    expect(items[2]?.textContent).toContain('טופל');
    expect(within(list()).getByText('3 דיווחים')).toBeTruthy();
    const tabs = within(list()).getByRole('tablist', { name: 'סטטוס' });
    expect(within(tabs).getByRole('tab', { name: 'הכל 3' })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: 'חדש 2' })).toBeTruthy();
    expect(within(tabs).getByRole('tab', { name: 'טופל 1' })).toBeTruthy();
  });

  it('RP2: filters by status and by category, and says when nothing matches', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'חדש 2' }));
    expect(within(list()).getAllByRole('link')).toHaveLength(2);
    fireEvent.click(screen.getByRole('radio', { name: 'מפגע 1' }));
    expect(within(list()).queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('אין דיווחים שמתאימים לסינון.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'הכל 3' }));
    const links = within(list()).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain('מדרון חלק');
  });

  it('RP3: shows every detail of the report and its photo in the Inspector', () => {
    renderPage({ selectedId: reportFinding.id });
    const panel = inspector();
    expect(within(panel).getByText('ממצא / רמז')).toBeTruthy();
    expect(within(panel).getByText('דיווח, חדש')).toBeTruthy();
    expect(within(panel).getByText('כפפה אפורה ליד השביל')).toBeTruthy();
    expect(within(panel).getByText('04')).toBeTruthy();
    expect(within(panel).getByText('דנה כהן')).toBeTruthy();
    expect(within(panel).getByText('ואדי צפוני')).toBeTruthy();
    expect(within(panel).getByText('16:44')).toBeTruthy();
    expect(within(panel).getByText('31.7742, 35.1301, ±5 מ׳')).toBeTruthy();
    expect(within(panel).getByRole('img', { name: 'תמונת הדיווח' }).getAttribute('src')).toBe(reportFinding.photoUrl);
  });

  it('RP3: shows no photo box for a report without a photo', () => {
    renderPage({ selectedId: reportHazard.id });
    expect(within(inspector()).queryByRole('img')).toBeNull();
  });

  it('RP4: marks a New report Handled, and offers nothing for a handled one', () => {
    const onHandle = vi.fn();
    renderPage({ selectedId: reportFinding.id, onHandle });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'סמן כטופל' }));
    expect(onHandle).toHaveBeenCalledWith(reportFinding.id);
    fireEvent.click(within(list()).getByRole('link', { name: /מדרון חלק/ }));
    expect(within(inspector()).queryByRole('button', { name: 'סמן כטופל' })).toBeNull();
  });

  it('RP5: edits the category and the text, and sends only what changed', () => {
    const onUpdate = vi.fn();
    renderPage({ selectedId: reportFinding.id, onUpdate });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
    fireEvent.click(screen.getByRole('radio', { name: 'כללי' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'תיאור' }), { target: { value: 'כפפה כחולה' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onUpdate).toHaveBeenCalledWith(reportFinding.id, { type: 'general', text: 'כפפה כחולה' });

    fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'תיאור' }), { target: { value: 'עדכון בלבד' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onUpdate).toHaveBeenLastCalledWith(reportFinding.id, { text: 'עדכון בלבד' });
  });

  it('RP5: refuses blank text, and cancel restores the view', () => {
    const onUpdate = vi.fn();
    renderPage({ selectedId: reportFinding.id, onUpdate });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'תיאור' }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(screen.getByText('כתבו תיאור.')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
    expect(screen.queryByRole('textbox', { name: 'תיאור' })).toBeNull();
    expect(within(inspector()).getByText('כפפה אפורה ליד השביל')).toBeTruthy();
  });

  it('RP5: saving without a change only closes the form', () => {
    const onUpdate = vi.fn();
    renderPage({ selectedId: reportFinding.id, onUpdate });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'תיאור' })).toBeNull();
  });

  it('RP6: deletes after a confirmation in place, and cancel hides it', () => {
    const onDelete = vi.fn();
    renderPage({ selectedId: reportFinding.id, onDelete });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'מחק' }));
    const confirm = screen.getByRole('group', { name: 'אישור מחיקה' });
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'בטל' }));
    expect(screen.queryByRole('group', { name: 'אישור מחיקה' })).toBeNull();
    fireEvent.click(within(inspector()).getByRole('button', { name: 'מחק' }));
    fireEvent.click(screen.getByRole('button', { name: 'מחק דיווח' }));
    expect(onDelete).toHaveBeenCalledWith(reportFinding.id);
  });

  it('RP7: offers no actions without handlers, and says an ended mission is read-only', () => {
    renderPage({
      selectedId: reportFinding.id,
      onHandle: undefined,
      onUpdate: undefined,
      onDelete: undefined,
      ended: true,
    });
    const panel = inspector();
    expect(within(panel).queryByRole('button', { name: 'סמן כטופל' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'ערוך' })).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'מחק' })).toBeNull();
    expect(within(panel).getByText('המסע הסתיים. הדיווחים לקריאה בלבד.')).toBeTruthy();
  });

  it('RP8: shows loading, a load failure with retry, and the empty state', () => {
    const onRetry = vi.fn();
    const { unmount } = renderPage({ reports: undefined });
    expect(screen.getByText('טוען דיווחים…')).toBeTruthy();
    unmount();

    const failed = renderPage({ reports: undefined, loadFailed: true, onRetry });
    expect(screen.getByRole('alert').textContent).toContain('לא ניתן לטעון את הדיווחים מהשרת.');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();
    failed.unmount();

    renderPage({ reports: [] });
    expect(screen.getByText('עוד לא התקבלו דיווחים במסע הזה.')).toBeTruthy();
  });

  it('RP9: shows the critical alert and the located note, and "פתח" selects the report', () => {
    renderPage({ selectedId: reportFinding.id });
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(alert.textContent).toContain('ממתין לאימות');
    fireEvent.click(within(alert).getByRole('button', { name: 'פתח' }));
    expect(within(inspector()).getByText('דיווח, חדש, ממתין לאימות')).toBeTruthy();
    expect(within(inspector()).getByText('דיווח אותר אינו סוגר את המסע')).toBeTruthy();
  });

  it('RP10: closes the Inspector, and a row opens it again', () => {
    renderPage({ selectedId: reportFinding.id });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('complementary', { name: 'פרטי דיווח' })).toBeNull();
    expect(screen.getByText('בחרו דיווח מהרשימה או מהמפה.')).toBeTruthy();
    fireEvent.click(within(list()).getByRole('link', { name: /מדרון חלק/ }));
    expect(within(inspector()).getByText('דיווח, טופל')).toBeTruthy();
  });

  it('RP10: a click on a report symbol on the map opens it', () => {
    renderPage({ selectedId: reportFinding.id });
    fireEvent.click(within(inspector()).getByRole('button', { name: 'סגור' }));
    act(() => mapProps.current?.onPointSelect?.({ kind: 'report', id: reportHazard.id }));
    expect(within(inspector()).getByText('דיווח, טופל')).toBeTruthy();
  });

  it('RP11: a report that arrives appears at the top of the list', () => {
    const { rerender } = render(<ReportsPage {...base} reports={[reportFinding, reportHazard]} />);
    expect(within(list()).getAllByRole('link')).toHaveLength(2);
    rerender(<ReportsPage {...base} reports={[reportLocated, reportFinding, reportHazard]} />);
    const links = within(list()).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]?.textContent).toContain('הנעדר אותר');
    expect(within(list()).getByText('3 דיווחים')).toBeTruthy();
  });

  it('RP12: shows an error, and disables the actions while busy', () => {
    renderPage({ selectedId: reportFinding.id, error: 'אין חיבור לשרת. השינוי לא נשמר.', busy: true });
    const panel = inspector();
    expect(within(panel).getByRole('alert').textContent).toBe('אין חיבור לשרת. השינוי לא נשמר.');
    for (const name of ['סמן כטופל', 'ערוך', 'מחק']) {
      expect(within(panel).getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
  });

  describe('keyboard focus', () => {
    it('B2: moves focus into the edit field, and back to "ערוך" after cancel and after save', () => {
      renderPage({ selectedId: reportFinding.id });
      fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
      expect(screen.getByRole('textbox', { name: 'תיאור' })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
      expect(within(inspector()).getByRole('button', { name: 'ערוך' })).toHaveFocus();

      fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'תיאור' }), { target: { value: 'חדש' } });
      fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
      expect(within(inspector()).getByRole('button', { name: 'ערוך' })).toHaveFocus();
    });

    it('B2: moves focus into the delete confirmation, and back to "מחק" after cancel', () => {
      renderPage({ selectedId: reportFinding.id });
      fireEvent.click(within(inspector()).getByRole('button', { name: 'מחק' }));
      const confirm = screen.getByRole('group', { name: 'אישור מחיקה' });
      expect(confirm.contains(document.activeElement)).toBe(true);
      fireEvent.click(within(confirm).getByRole('button', { name: 'בטל' }));
      expect(within(inspector()).getByRole('button', { name: 'מחק' })).toHaveFocus();
    });

    it('B2: moves focus to the list when the report is deleted', () => {
      renderPage({ selectedId: reportFinding.id });
      fireEvent.click(within(inspector()).getByRole('button', { name: 'מחק' }));
      fireEvent.click(screen.getByRole('button', { name: 'מחק דיווח' }));
      expect(list()).toHaveFocus();
    });

    it('B3: Escape cancels the edit form and the delete confirmation, returning focus to the trigger', () => {
      renderPage({ selectedId: reportFinding.id });
      fireEvent.click(within(inspector()).getByRole('button', { name: 'ערוך' }));
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'תיאור' }), { key: 'Escape' });
      expect(screen.queryByRole('textbox', { name: 'תיאור' })).toBeNull();
      expect(within(inspector()).getByRole('button', { name: 'ערוך' })).toHaveFocus();

      fireEvent.click(within(inspector()).getByRole('button', { name: 'מחק' }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      expect(screen.queryByRole('group', { name: 'אישור מחיקה' })).toBeNull();
      expect(within(inspector()).getByRole('button', { name: 'מחק' })).toHaveFocus();
    });
  });
});
