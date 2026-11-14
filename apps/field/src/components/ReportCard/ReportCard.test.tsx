import { themes } from '@trace/design';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportCard } from '.';
import { usePreferences } from '../../state/preferences';
import { ThemeProvider } from '../../theme';
import type { ReportItem } from '../../reports/reportItems';

const item = (overrides: Partial<ReportItem> = {}): ReportItem => ({
  id: 'r1',
  type: 'hazard',
  typeLabel: 'מפגע',
  text: 'מדרון חלק ליד הערוץ',
  time: '16:44',
  position: [35.0152, 31.7421],
  mine: false,
  callsign: 11,
  name: 'יוסי דהן',
  polygonId: 'p1',
  polygonName: 'A',
  distanceMeters: 124,
  photoUrl: null,
  pending: false,
  located: false,
  hazard: true,
  ...overrides,
});

const show = (value: ReportItem, selected = false, onPress = () => undefined, onEdit?: () => void) =>
  render(<ReportCard item={value} selected={selected} onPress={onPress} onEdit={onEdit} />, { wrapper: ThemeProvider });

beforeEach(() => usePreferences.setState(usePreferences.getInitialState()));

describe('ReportCard collapsed', () => {
  it('shows the type, the time, the text, the author and the distance from me', () => {
    show(item());
    expect(screen.getByText('מפגע')).toBeInTheDocument();
    expect(screen.getByText('16:44')).toBeInTheDocument();
    expect(screen.getByText('מדרון חלק ליד הערוץ')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('יוסי דהן')).toBeInTheDocument();
    expect(screen.getByText('· 120 מ׳ ממני')).toBeInTheDocument();
    expect(screen.queryByText('שלי')).toBeNull();
  });

  it('leaves out the distance when it is not known', () => {
    show(item({ distanceMeters: null }));
    expect(screen.queryByText(/ממני/)).toBeNull();
  });

  it('marks my own report, without a callsign chip', () => {
    show(item({ mine: true, distanceMeters: null }));
    expect(screen.getByText('שלי')).toBeInTheDocument();
    expect(screen.getByText('הדיווח שלי')).toBeInTheDocument();
    expect(screen.queryByText('יוסי דהן')).toBeNull();
    expect(screen.queryByText('11')).toBeNull();
  });

  it('says a report waits for sync, and not that it was sent', () => {
    show(item({ mine: true, pending: true, distanceMeters: null }), true);
    expect(screen.getByText('ממתין לסנכרון')).toBeInTheDocument();
    expect(screen.queryByText('נשלח')).toBeNull();
  });

  it('names the author and the distance for screen readers, and "שלי" for my own report', () => {
    show(item());
    expect(
      screen.getByRole('button', { name: 'מפגע, 16:44, מדרון חלק ליד הערוץ, 11 יוסי דהן, 120 מ׳ ממני' }),
    ).toBeInTheDocument();
  });

  it('writes the callsign as the chip does, with a leading zero', () => {
    show(item({ callsign: 3, distanceMeters: null }));
    expect(screen.getByRole('button', { name: 'מפגע, 16:44, מדרון חלק ליד הערוץ, 03 יוסי דהן' })).toBeInTheDocument();
  });

  it('names my own report as mine', () => {
    show(item({ mine: true, distanceMeters: null }));
    expect(screen.getByRole('button', { name: 'מפגע, 16:44, מדרון חלק ליד הערוץ, הדיווח שלי' })).toBeInTheDocument();
  });

  it('is a button that opens the details when pressed', () => {
    const onPress = vi.fn();
    show(item(), false, onPress);
    const button = screen.getByRole('button', { name: /מפגע, 16:44/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ReportCard expanded', () => {
  it('shows the coordinates, the polygon and the photo placeholder', () => {
    show(item(), true);
    expect(screen.getByRole('button', { name: /מפגע, 16:44/ })).toHaveAttribute('aria-expanded', 'true');
    // The numbers are isolated left to right inside the Hebrew line; the isolate marks are not text to read.
    expect(
      screen.getByText((text) => text.replace(/[\u2066\u2069]/g, '').startsWith('31.7421, 35.0152')),
    ).toBeInTheDocument();
    expect(screen.getByText(/פוליגון A/)).toBeInTheDocument();
    expect(screen.getByText('תמונה')).toBeInTheDocument();
  });

  it('shows "נשלח" for my own report the server has', () => {
    show(item({ mine: true, distanceMeters: null }), true);
    expect(screen.getByText('נשלח')).toBeInTheDocument();
  });

  it('does not say "נשלח" for someone else’s report', () => {
    show(item(), true);
    expect(screen.queryByText('נשלח')).toBeNull();
  });

  it('leaves out the polygon when it is not known', () => {
    show(item({ polygonName: null }), true);
    expect(screen.queryByText(/פוליגון/)).toBeNull();
  });

  it.each(['night', 'day'] as const)('raises the selected card in the %s theme', (id) => {
    usePreferences.setState({ themePreference: id });
    show(item(), true);
    expect(screen.getByRole('button', { name: /מפגע, 16:44/ })).toHaveStyle({
      backgroundColor: themes[id].color.surfaceRaised,
    });
  });
});

describe('ReportCard edit (UC-C11, decision 88)', () => {
  const mine = item({ mine: true, distanceMeters: null });

  it('offers "עריכה" on my own open report that the server has', () => {
    const onEdit = vi.fn();
    show(mine, true, undefined, onEdit);
    fireEvent.click(screen.getByRole('button', { name: 'עריכה' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('does not offer it closed, for someone else’s report, or for one that waits to be sent', () => {
    const onEdit = vi.fn();
    show(mine, false, undefined, onEdit);
    expect(screen.queryByRole('button', { name: 'עריכה' })).toBeNull();
  });

  it('does not offer it on someone else’s report', () => {
    show(item(), true, undefined, vi.fn());
    expect(screen.queryByRole('button', { name: 'עריכה' })).toBeNull();
  });

  it('does not offer it on a report that waits for sync', () => {
    show({ ...mine, pending: true }, true, undefined, vi.fn());
    expect(screen.queryByRole('button', { name: 'עריכה' })).toBeNull();
  });

  it('does not offer it when no edit handler is given', () => {
    show(mine, true);
    expect(screen.queryByRole('button', { name: 'עריכה' })).toBeNull();
  });
});

describe('ReportCard identity', () => {
  it('keeps the same card element, so focus is not lost, when it is selected and gets its edit button', () => {
    const mine = item({ mine: true });
    const onEdit = () => undefined;
    const { rerender } = render(<ReportCard item={mine} selected={false} onPress={() => undefined} onEdit={onEdit} />, {
      wrapper: ThemeProvider,
    });
    const card = screen.getByRole('button', { expanded: false });
    card.focus();
    expect(document.activeElement).toBe(card);
    rerender(<ReportCard item={mine} selected onPress={() => undefined} onEdit={onEdit} />);
    expect(screen.getByRole('button', { expanded: true })).toBe(card);
    expect(document.activeElement).toBe(card);
    expect(screen.getByRole('button', { name: 'עריכה' })).toBeInTheDocument();
  });
});
