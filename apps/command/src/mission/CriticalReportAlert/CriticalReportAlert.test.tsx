import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CriticalReportAlert } from '.';
import { reportFinding, reportHazard, reportLocated } from '../fixtures';

describe('CriticalReportAlert', () => {
  it('shows nothing without a New located report', () => {
    const handled = { ...reportLocated, status: 'handled' as const };
    const { container } = render(
      <CriticalReportAlert reports={[handled, reportFinding, reportHazard]} onOpen={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says who located the missing person and when, and that the mission stays open', () => {
    render(<CriticalReportAlert reports={[reportFinding, reportLocated]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(within(alert).getByText('קריטי')).toBeTruthy();
    expect(alert.textContent).toContain('דיווח "הנעדר אותר"');
    expect(within(alert).getByText('02')).toBeTruthy();
    expect(alert.textContent).toContain('שחר מור');
    expect(within(alert).getByText('16:51')).toBeTruthy();
    expect(alert.textContent).toContain('ממתין לאימות');
    expect(alert.textContent).toContain('הדיווח אינו סוגר את המסע');
  });

  it('counts the alerts when there are several and shows the newest', () => {
    const older = {
      ...reportLocated,
      id: '00000000-0000-4000-8000-0000000007c1',
      reportedAt: '2026-10-03T13:10:00.000Z',
    };
    render(<CriticalReportAlert reports={[reportLocated, older]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(within(alert).getByText('קריטי · 2')).toBeTruthy();
    expect(within(alert).getByText('16:51')).toBeTruthy();
  });

  it('opens the report', () => {
    const onOpen = vi.fn();
    render(<CriticalReportAlert reports={[reportLocated]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }));
    expect(onOpen).toHaveBeenCalledWith(reportLocated.id);
  });

  it('names the commander without a callsign chip', () => {
    const own = { ...reportLocated, reportedBy: { role: 'commander' as const, name: 'ישי', callsign: null } };
    render(<CriticalReportAlert reports={[own]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(alert.textContent).toContain('ישי');
    expect(within(alert).queryByText('02')).toBeNull();
  });

  it('CA1: compact keeps the alert but drops the second line', () => {
    const onOpen = vi.fn();
    render(<CriticalReportAlert compact reports={[reportLocated]} onOpen={onOpen} />);
    const alert = screen.getByRole('alert', { name: 'התראה קריטית' });
    expect(alert).toHaveAttribute('data-compact');
    expect(within(alert).getByText('קריטי')).toBeTruthy();
    expect(within(alert).getByText('02')).toBeTruthy();
    expect(within(alert).getByText('16:51')).toBeTruthy();
    expect(alert.textContent).toContain('ממתין לאימות');
    expect(alert.textContent).not.toContain('הדיווח אינו סוגר את המסע');
    fireEvent.click(within(alert).getByRole('button', { name: 'פתח' }));
    expect(onOpen).toHaveBeenCalledWith(reportLocated.id);
  });
});
