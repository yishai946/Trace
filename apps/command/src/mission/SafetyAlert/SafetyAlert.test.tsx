import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SafetyAlert } from '.';
import type { SafetyWarning } from '../safetyWarnings';

const dana: SafetyWarning = {
  key: 'outside:4',
  title: 'מחפש מחוץ לפוליגון',
  participantId: '00000000-0000-4000-8000-000000000004',
  callsign: 4,
  name: 'דנה כהן',
  message: 'מחוץ לואדי צפוני, 80 מ׳ מהגבול',
  since: '2026-10-03T13:55:00.000Z',
};
const coverage: SafetyWarning = {
  key: 'coverage:a:80',
  title: 'כיסוי פוליגון',
  participantId: null,
  callsign: null,
  name: 'ואדי צפוני',
  message: 'הכיסוי עבר 80%',
  since: null,
};
const name = 'אזהרה: מחפש מחוץ לפוליגון';

describe('SafetyAlert', () => {
  it('has a compact form for the phone', () => {
    render(<SafetyAlert compact warnings={[dana]} onOpen={vi.fn()} />);
    expect(screen.getByRole('alert', { name })).toHaveAttribute('data-compact', 'true');
  });

  it('shows nothing without a warning', () => {
    const { container } = render(<SafetyAlert warnings={[]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says who, what and since when', () => {
    render(<SafetyAlert warnings={[dana]} onOpen={vi.fn()} />);
    const alert = screen.getByRole('alert', { name });
    expect(within(alert).getByText('אזהרה')).toBeTruthy();
    expect(within(alert).getByText('04')).toBeTruthy();
    expect(alert.textContent).toContain('דנה כהן מחוץ לואדי צפוני, 80 מ׳ מהגבול, מאז');
    expect(within(alert).getByText('16:55')).toBeTruthy();
  });

  it('counts the warnings, opens the shown searcher and moves to the next', () => {
    const onOpen = vi.fn();
    render(<SafetyAlert warnings={[dana, coverage]} onOpen={onOpen} />);
    expect(screen.getByText('אזהרה · 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'פתח' }));
    expect(onOpen).toHaveBeenCalledWith(dana.participantId);
    fireEvent.click(screen.getByRole('button', { name: 'הבא' }));
    expect(screen.getByRole('alert', { name: 'אזהרה: כיסוי פוליגון' })).toBeTruthy();
  });

  it('lets the commander close a Coverage warning', () => {
    const { unmount } = render(<SafetyAlert warnings={[coverage]} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();
    render(<SafetyAlert warnings={[coverage]} onOpen={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
