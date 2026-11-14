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
import { PhoneReportsPage, type PhoneReportsPageProps } from '.';

// The map needs WebGL: a stand-in that keeps what the page gave it and lets a test tap a report symbol.
const mapProps = vi.hoisted(() => ({
  current: null as null | {
    data: { reports: unknown[] };
    focus: { center: number[]; bounds?: number[] } | null;
    onPointSelect?: (t: { kind: 'report'; id: string }) => void;
  },
}));
vi.mock('../../map/MissionMap', () => ({
  MissionMap: (props: NonNullable<typeof mapProps.current>) => {
    mapProps.current = props;
    return <div data-testid="map" />;
  },
}));

const base: PhoneReportsPageProps = {
  reports,
  loadFailed: false,
  onRetry: vi.fn(),
  mission,
  polygons: [polygonA],
  participants,
  sightings: [],
  lkps,
  provider: {} as PhoneReportsPageProps['provider'],
  themeId: 'night',
  connection: { state: 'up', label: 'זמין', detail: 'מחובר לשרת. המפה מתעדכנת בזמן אמת.' },
  selectedId: null,
  onSelect: vi.fn(),
  onHandle: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  busy: false,
  error: null,
  ended: false,
};

/** Holds the selection the way the console does, so choosing a row selects it. */
function Harness(props: Partial<PhoneReportsPageProps>) {
  const [selectedId, setSelectedId] = useState<string | null>(props.selectedId ?? null);
  return <PhoneReportsPage {...base} {...props} selectedId={selectedId} onSelect={setSelectedId} />;
}
const renderPage = (props: Partial<PhoneReportsPageProps> = {}) => render(<Harness {...props} />);
const card = () => screen.getByRole('region', { name: 'פרטי דיווח' });
const list = () => screen.getByRole('region', { name: 'רשימת דיווחים' });
const chips = () => screen.getByRole('radiogroup', { name: 'סינון' });

beforeEach(() => vi.clearAllMocks());

describe('PhoneReportsPage', () => {
  it('PR1: has the title, the connection, the view switch and the filter chips', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'דיווחים' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('זמין');
    const views = screen.getByRole('tablist', { name: 'תצוגה' });
    expect(within(views).getByRole('tab', { name: 'רשימה', selected: true })).toBeTruthy();
    expect(within(views).getByRole('tab', { name: 'מפה' })).toBeTruthy();
    expect(within(chips()).getByRole('radio', { name: 'הכל 3', checked: true })).toBeTruthy();
    for (const name of ['חדש 2', 'ממצא / רמז', 'מפגע', 'לא נגיש', 'כללי']) {
      expect(within(chips()).getByRole('radio', { name })).toBeTruthy();
    }
    expect(within(chips()).queryByRole('radio', { name: 'הנעדר אותר' })).toBeNull();
  });

  it('PR2: opens on the critical card, and lists the other reports', () => {
    renderPage();
    const c = card();
    expect(within(c).getByText('קריטי')).toBeTruthy();
    expect(within(c).getByRole('heading', { name: 'הנעדר אותר' })).toBeTruthy();
    expect(within(c).getByText('חדש')).toBeTruthy();
    expect(within(c).getByText('02')).toBeTruthy();
    expect(c.textContent).toContain('שחר מור');
    expect(c.textContent).toContain('ואדי צפוני');
    expect(within(c).getByText('16:51')).toBeTruthy();
    expect(c.textContent).toContain('ממתין לאימות');
    expect(c.textContent).toContain('מיקום GPS:');
    expect(c.textContent).toContain('±5 מ׳');
    expect(c.textContent).toContain('הדיווח אינו סוגר את המסע. רק המנהל מסיים אחרי אימות.');
    expect(within(list()).getAllByRole('link')).toHaveLength(2);
  });

  it('PR3: shows no card and every row when no report is critical', () => {
    renderPage({ reports: [reportFinding, reportHazard] });
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
    expect(within(list()).getAllByRole('link')).toHaveLength(2);
  });

  it('PR4: a row opens its report in the card, with the photo, and moves focus there', () => {
    const onSelect = vi.fn();
    renderPage({ onSelect });
    fireEvent.click(within(list()).getByRole('link', { name: /כפפה אפורה ליד השביל/ }));
    const c = card();
    expect(c.textContent).toContain('כפפה אפורה ליד השביל');
    const photo = within(c).getByRole('img', { name: 'תמונת הדיווח' });
    expect(photo.closest('a')?.getAttribute('href')).toBe(reportFinding.photoUrl);
    expect(c).toHaveFocus();
    const links = within(list()).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.some((l) => l.textContent?.includes('כפפה אפורה ליד השביל'))).toBe(false);
    expect(links[0]?.textContent).toContain('הנעדר אותר');
  });

  it('PR5: a chip filters the rows and the card', () => {
    renderPage();
    fireEvent.click(within(chips()).getByRole('radio', { name: 'חדש 2' }));
    expect(within(list()).getAllByRole('link')).toHaveLength(1);
    fireEvent.click(within(chips()).getByRole('radio', { name: 'מפגע' }));
    expect(within(list()).getAllByRole('link')).toHaveLength(1);
    expect(within(list()).getByRole('link').textContent).toContain('מדרון חלק');
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
    fireEvent.click(within(chips()).getByRole('radio', { name: 'כללי' }));
    expect(screen.getByText('אין דיווחים שמתאימים לסינון.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
  });

  it('PR6: marks a New report Handled, and offers nothing for a handled one', () => {
    const onHandle = vi.fn();
    const { unmount } = renderPage({ onHandle });
    fireEvent.click(within(card()).getByRole('button', { name: 'סמן כטופל' }));
    expect(onHandle).toHaveBeenCalledWith(reportLocated.id);
    unmount();
    renderPage({ selectedId: reportHazard.id });
    expect(within(card()).getByText('טופל')).toBeTruthy();
    expect(within(card()).queryByRole('button', { name: 'סמן כטופל' })).toBeNull();
  });

  it('PR7: edits the text, saves it, and Escape closes the form with focus back on "ערוך"', () => {
    const onUpdate = vi.fn();
    renderPage({ onUpdate });
    fireEvent.click(within(card()).getByRole('button', { name: 'ערוך' }));
    expect(screen.getByRole('form', { name: 'עריכת דיווח' })).toBeTruthy();
    const field = screen.getByRole('textbox', { name: /תיאור/ });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'אדם ליד הנחל' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמור' }));
    expect(onUpdate).toHaveBeenCalledWith(reportLocated.id, { text: 'אדם ליד הנחל' });

    fireEvent.click(within(card()).getByRole('button', { name: 'ערוך' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: /תיאור/ }), { key: 'Escape' });
    expect(screen.queryByRole('form', { name: 'עריכת דיווח' })).toBeNull();
    expect(within(card()).getByRole('button', { name: 'ערוך' })).toHaveFocus();
  });

  it('PR8: deletes after a confirmation in place, and focus goes to the list', () => {
    const onDelete = vi.fn();
    renderPage({ onDelete });
    fireEvent.click(within(card()).getByRole('button', { name: 'מחק' }));
    const confirm = screen.getByRole('group', { name: 'אישור מחיקה' });
    expect(within(confirm).getByRole('button', { name: 'בטל' })).toHaveFocus();
    fireEvent.click(within(confirm).getByRole('button', { name: 'בטל' }));
    expect(within(card()).getByRole('button', { name: 'מחק' })).toHaveFocus();
    fireEvent.click(within(card()).getByRole('button', { name: 'מחק' }));
    fireEvent.click(screen.getByRole('button', { name: 'מחק דיווח' }));
    expect(onDelete).toHaveBeenCalledWith(reportLocated.id);
    expect(list()).toHaveFocus();
  });

  it('PR9: offers no actions without handlers, and says an ended mission is read-only', () => {
    renderPage({ onHandle: undefined, onUpdate: undefined, onDelete: undefined, ended: true });
    const c = card();
    for (const name of ['סמן כטופל', 'ערוך', 'מחק']) {
      expect(within(c).queryByRole('button', { name })).toBeNull();
    }
    expect(c.textContent).toContain('המסע הסתיים. הדיווחים לקריאה בלבד.');
  });

  it('PR10: disables the actions while busy, and shows an error', () => {
    renderPage({ busy: true, error: 'הפעולה נכשלה' });
    for (const name of ['סמן כטופל', 'ערוך', 'מחק']) {
      expect(within(card()).getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
    expect(within(card()).getByRole('alert').textContent).toBe('הפעולה נכשלה');
  });

  it('PR11: says when the reports are loading, failed (with retry) or empty', () => {
    const onRetry = vi.fn();
    const loading = renderPage({ reports: undefined });
    expect(screen.getByText('טוען דיווחים…')).toBeTruthy();
    loading.unmount();
    const failed = renderPage({ reports: undefined, loadFailed: true, onRetry });
    expect(screen.getByRole('alert').textContent).toContain('לא ניתן לטעון את הדיווחים מהשרת.');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledOnce();
    failed.unmount();
    renderPage({ reports: [] });
    expect(screen.getByText('עוד לא התקבלו דיווחים במסע הזה.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
  });

  it('PR12: closes the card, and a row shows it again', () => {
    renderPage();
    fireEvent.click(within(card()).getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
    fireEvent.click(within(list()).getAllByRole('link')[0]!);
    expect(card()).toBeTruthy();
  });

  it('PR13: the map view shows the filtered reports, and a tap on a symbol opens the card', () => {
    renderPage({ reports: [reportFinding, reportHazard, reportLocated] });
    fireEvent.click(screen.getByRole('tab', { name: 'מפה' }));
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'רשימת דיווחים' })).toBeNull();
    expect(mapProps.current?.data.reports).toHaveLength(3);
    fireEvent.click(within(chips()).getByRole('radio', { name: 'מפגע' }));
    expect(mapProps.current?.data.reports).toHaveLength(1);
    fireEvent.click(within(chips()).getByRole('radio', { name: 'הכל 3' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'סגור' }));
    act(() => mapProps.current?.onPointSelect?.({ kind: 'report', id: reportFinding.id }));
    expect(card().textContent).toContain('כפפה אפורה ליד השביל');
  });

  it('PR14: a deleted report falls back to the critical card without throwing', () => {
    const { rerender } = render(<PhoneReportsPage {...base} selectedId={reportFinding.id} />);
    expect(card().textContent).toContain('כפפה אפורה ליד השביל');
    rerender(<PhoneReportsPage {...base} selectedId={reportFinding.id} reports={[reportLocated, reportHazard]} />);
    expect(within(card()).getByRole('heading', { name: 'הנעדר אותר' })).toBeTruthy();
  });

  it('PR15: shows a commander reporter by name, without a callsign chip', () => {
    const byCommander = { ...reportFinding, reportedBy: { role: 'commander' as const, name: 'ישי', callsign: null } };
    renderPage({ reports: [byCommander], selectedId: byCommander.id });
    expect(card().textContent).toContain('ישי');
    expect(within(card()).queryByText('04')).toBeNull();
  });

  it('FX1: takes focus into the card when it opens with focus lost', () => {
    renderPage({ selectedId: reportFinding.id });
    expect(card()).toHaveFocus();
  });

  it('FX2: closing the card moves focus to the heading', () => {
    renderPage();
    fireEvent.click(within(card()).getByRole('button', { name: 'סגור' }));
    expect(screen.getByRole('heading', { level: 1, name: 'דיווחים' })).toHaveFocus();
  });

  it('FX3: marking the critical card Handled keeps focus on the page', () => {
    const { rerender } = render(<PhoneReportsPage {...base} reports={[reportLocated, reportFinding]} />);
    within(card()).getByRole('button', { name: 'סמן כטופל' }).focus();
    const handled = { ...reportLocated, status: 'handled' as const };
    rerender(<PhoneReportsPage {...base} reports={[handled, reportFinding]} />);
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('heading', { level: 1, name: 'דיווחים' })).toHaveFocus();
  });

  it('CL1: a new critical report that arrives shows its card again, after the card was closed', () => {
    const open = { ...base, selectedId: reportFinding.id };
    const { rerender } = render(<PhoneReportsPage {...open} reports={[reportFinding, reportHazard]} />);
    fireEvent.click(within(card()).getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
    rerender(<PhoneReportsPage {...open} reports={[reportLocated, reportFinding, reportHazard]} />);
    expect(within(card()).getByRole('heading', { name: 'הנעדר אותר' })).toBeTruthy();
  });

  it('CL2: a critical report that was already there stays closed', () => {
    const { rerender } = render(<PhoneReportsPage {...base} reports={reports} />);
    fireEvent.click(within(card()).getByRole('button', { name: 'סגור' }));
    rerender(<PhoneReportsPage {...base} reports={[...reports]} />);
    expect(screen.queryByRole('region', { name: 'פרטי דיווח' })).toBeNull();
  });

  it('FX4: marking a selected report Handled moves focus to its card, not the page', () => {
    const open = { ...base, selectedId: reportFinding.id };
    const { rerender } = render(<PhoneReportsPage {...open} reports={[reportFinding, reportHazard]} />);
    within(card()).getByRole('button', { name: 'סמן כטופל' }).focus();
    rerender(<PhoneReportsPage {...open} reports={[{ ...reportFinding, status: 'handled' }, reportHazard]} />);
    expect(card()).toHaveFocus();
  });

  it('MF1: fits the map once when the reports arrive after it opened', () => {
    const { rerender } = render(<PhoneReportsPage {...base} reports={undefined} polygons={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'מפה' }));
    expect(mapProps.current?.focus).toBeNull();
    rerender(<PhoneReportsPage {...base} reports={reports} polygons={[]} />);
    expect(mapProps.current?.focus?.bounds).toHaveLength(4);
    const first = mapProps.current?.focus;
    rerender(<PhoneReportsPage {...base} reports={[reportFinding]} polygons={[]} />);
    expect(mapProps.current?.focus).toBe(first);
  });

  it('MF2: does not refit when the data was there at mount', () => {
    render(<PhoneReportsPage {...base} />);
    fireEvent.click(screen.getByRole('tab', { name: 'מפה' }));
    expect(mapProps.current?.focus).toBeNull();
  });
});
