import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsList } from '.';
import type { ReportItem } from '../../reports/reportItems';
import { ThemeProvider } from '../../theme';

const item = (id: string, text: string): ReportItem => ({
  id,
  type: 'hazard',
  typeLabel: 'מפגע',
  text,
  time: '16:44',
  position: [35.0152, 31.7421],
  mine: false,
  callsign: 11,
  name: 'יוסי דהן',
  polygonId: 'p1',
  polygonName: 'A',
  distanceMeters: null,
  photoUrl: null,
  pending: false,
  located: false,
  hazard: true,
});

const base = {
  items: [] as ReportItem[],
  state: 'ready' as const,
  empty: 'אין עדיין דיווחים בפוליגון',
  selectedId: null,
  onSelect: () => undefined,
  onRetry: () => undefined,
};
const show = (props: Partial<Parameters<typeof ReportsList>[0]> = {}) =>
  render(<ReportsList {...base} {...props} />, { wrapper: ThemeProvider });

describe('ReportsList', () => {
  it('says it is loading', () => {
    show({ state: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('טוען דיווחים…');
  });

  it('says it failed and tries again on request', () => {
    const onRetry = vi.fn();
    show({ state: 'error', onRetry });
    expect(screen.getByRole('alert')).toHaveTextContent('לא ניתן לטעון את הדיווחים');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty text it is given', () => {
    show({ empty: 'עדיין לא שלחת דיווחים' });
    expect(screen.getByText('עדיין לא שלחת דיווחים')).toBeInTheDocument();
  });

  it('lists the reports, newest first as given, in a labelled list', () => {
    show({ items: [item('a', 'ראשון'), item('b', 'שני')] });
    expect(screen.getByLabelText('רשימת דיווחים')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'מפגע, 16:44, ראשון, 11 יוסי דהן',
      'מפגע, 16:44, שני, 11 יוסי דהן',
    ]);
  });

  it('opens a report when pressed and closes the open one when pressed again', () => {
    const onSelect = vi.fn();
    const { rerender } = show({ items: [item('a', 'ראשון')], onSelect });
    fireEvent.click(screen.getByRole('button', { name: /ראשון/ }));
    expect(onSelect).toHaveBeenLastCalledWith('a');
    rerender(<ReportsList {...base} items={[item('a', 'ראשון')]} selectedId="a" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /ראשון/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /ראשון/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
