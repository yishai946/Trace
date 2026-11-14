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

const show = (value: ReportItem, selected = false, onPress = () => undefined) =>
  render(<ReportCard item={value} selected={selected} onPress={onPress} />, { wrapper: ThemeProvider });

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
