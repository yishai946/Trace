import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FloatingAlerts } from '.';
import type { OutsideSearcher } from '../outsideSearchers';
import { reportFinding, reportLocated, sosActive, sosClosed } from '../fixtures';

const open = { onOpenReport: vi.fn(), onOpenSos: vi.fn() };

describe('FloatingAlerts', () => {
  it('shows nothing without an active SOS or a critical report', () => {
    const { container } = render(<FloatingAlerts reports={[reportFinding]} sos={[sosClosed]} {...open} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('puts the SOS above the critical report when both are active', () => {
    render(<FloatingAlerts reports={[reportLocated]} sos={[sosActive]} {...open} />);
    const alerts = screen.getAllByRole('alert').map((a) => a.getAttribute('aria-label'));
    expect(alerts).toEqual(['התראת SOS', 'התראה קריטית']);
  });

  it('shows the SOS alone, and the report alone', () => {
    const { rerender } = render(<FloatingAlerts reports={[]} sos={[sosActive]} {...open} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    rerender(<FloatingAlerts reports={[reportLocated]} sos={[]} {...open} />);
    expect(screen.getByRole('alert', { name: 'התראה קריטית' })).toBeTruthy();
  });

  it('says the SOS state is unknown when it failed to load, even with nothing else to show', () => {
    render(<FloatingAlerts reports={[]} sos={[]} sosFailed onRetrySos={vi.fn()} {...open} />);
    expect(screen.getByRole('alert', { name: 'מצב SOS לא ידוע' })).toBeTruthy();
  });

  it('puts the out-of-polygon warning under the SOS and the critical report', () => {
    const outside: OutsideSearcher[] = [
      {
        participantId: sosActive.id,
        callsign: 4,
        name: 'דנה',
        polygonName: 'ואדי',
        meters: 80,
        since: sosActive.activatedAt,
      },
    ];
    render(<FloatingAlerts reports={[reportLocated]} sos={[sosActive]} outside={outside} {...open} />);
    const alerts = screen.getAllByRole('alert').map((a) => a.getAttribute('aria-label'));
    expect(alerts).toEqual(['התראת SOS', 'התראה קריטית', 'אזהרה: מחפש מחוץ לפוליגון']);
  });

  it('passes "אמת וסיים מסע…" to the critical report only when the mission can be ended (UC-C16)', () => {
    const onFinish = vi.fn();
    const { rerender } = render(<FloatingAlerts reports={[reportLocated]} sos={[]} {...open} />);
    expect(screen.queryByRole('button', { name: 'אמת וסיים מסע…' })).toBeNull();
    rerender(<FloatingAlerts reports={[reportLocated]} sos={[]} onFinish={onFinish} {...open} />);
    fireEvent.click(screen.getByRole('button', { name: 'אמת וסיים מסע…' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
