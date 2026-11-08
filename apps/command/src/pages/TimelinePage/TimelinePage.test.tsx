import type { TimelineEvent } from '@trace/schemas';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, TimelinePage, type TimelinePageProps } from '.';
import { eventSamples, timelineEvents } from '../../mission/fixtures';
import { formatEventTime } from '../../mission/timelineEvent';

const props = (overrides: Partial<TimelinePageProps> = {}): TimelinePageProps => ({
  events: timelineEvents,
  loadFailed: false,
  onRetry: vi.fn(),
  onGoToMap: vi.fn(),
  ...overrides,
});

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

/** `count` polygon events, one minute apart, oldest first. */
const manyEvents = (count: number): TimelineEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    ...eventSamples['polygon.created'],
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    occurredAt: new Date(Date.UTC(2026, 9, 3, 10, i)).toISOString(),
    subject: { ...eventSamples['polygon.created'].subject, label: `פוליגון ${i + 1}` },
  }));

describe('TimelinePage', () => {
  it('lists the newest event first', () => {
    render(<TimelinePage {...props()} />);

    expect(rows()).toHaveLength(timelineEvents.length);
    expect(within(rows()[0] as HTMLElement).getByText(/הפעיל SOS/)).toBeTruthy();
    expect(within(rows().at(-1) as HTMLElement).getByText('המסע נוצר, מסע 0412')).toBeTruthy();
  });

  it('states how many events there are and the span they cover', () => {
    render(<TimelinePage {...props()} />);

    const first = formatEventTime(eventSamples['mission.created'].occurredAt, false);
    const last = formatEventTime(eventSamples['sos.activated'].occurredAt, false);
    const meta = screen.getByText(/אירועים משמעותיים/);
    expect(meta.textContent).toBe(`5 אירועים משמעותיים, מ-${first} עד ${last}, מהחדש לישן`);
  });

  it('words a single event on its own', () => {
    render(<TimelinePage {...props({ events: [eventSamples['mission.created']] })} />);

    const time = formatEventTime(eventSamples['mission.created'].occurredAt, false);
    expect(screen.getByText(/אירוע משמעותי אחד/).textContent).toBe(`אירוע משמעותי אחד, ב-${time}`);
  });

  it('offers "הכל" and only the kinds that have events, with counts', () => {
    render(<TimelinePage {...props()} />);

    const group = screen.getByRole('radiogroup', { name: 'סינון לפי סוג אירוע' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((chip) => chip.textContent),
    ).toEqual(['הכל 5', 'SOS 1', 'שינויי מסע 4']);
  });

  it('filters the rows by kind', () => {
    render(<TimelinePage {...props()} />);

    fireEvent.click(screen.getByRole('radio', { name: /שינויי מסע/ }));
    expect(rows()).toHaveLength(4);
    expect(screen.getByText('מוצגים 4 מתוך 4')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /הכל/ }));
    expect(rows()).toHaveLength(5);
  });

  it('shows a loading state, then an error with a retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<TimelinePage {...props({ events: undefined })} />);
    expect(screen.getByText('טוען ציר זמן…')).toBeTruthy();

    rerender(<TimelinePage {...props({ events: undefined, loadFailed: true, onRetry })} />);
    expect(screen.getByRole('alert').textContent).toContain('לא ניתן לטעון את ציר הזמן מהשרת.');
    fireEvent.click(screen.getByRole('button', { name: 'נסה שוב' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says so when the mission has no events yet', () => {
    render(<TimelinePage {...props({ events: [] })} />);

    expect(screen.getByText('אין עדיין אירועים במסע הזה.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows 50 events at a time and loads earlier ones on request', () => {
    render(<TimelinePage {...props({ events: manyEvents(55) })} />);

    expect(PAGE_SIZE).toBe(50);
    expect(rows()).toHaveLength(50);
    expect(screen.getByText('מוצגים 50 מתוך 55')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'טען אירועים קודמים' }));
    expect(rows()).toHaveLength(55);
    expect(screen.getByText('מוצגים 55 מתוך 55')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'טען אירועים קודמים' })).toBeNull();
  });

  it('goes to the map from an event that is shown there', () => {
    const onGoToMap = vi.fn();
    render(<TimelinePage {...props({ onGoToMap })} />);

    fireEvent.click(within(rows()[2] as HTMLElement).getByRole('link', { name: 'לוח מבצעי' }));
    expect(onGoToMap).toHaveBeenCalled();
    expect(within(rows()[0] as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('shows the history of an ended mission: the page has no status gate', () => {
    render(<TimelinePage {...props({ events: [...timelineEvents, eventSamples['mission.ended']] })} />);

    expect(within(rows()[0] as HTMLElement).getByText('המסע הסתיים, הנעדר אותר')).toBeTruthy();
    expect(rows()).toHaveLength(6);
  });

  it('marks an SOS row as danger and shows the callsign as a chip', () => {
    render(<TimelinePage {...props()} />);

    const sos = rows()[0] as HTMLElement;
    expect(sos.getAttribute('data-danger')).toBe('true');
    expect(within(sos).getByText('07')).toBeTruthy();
    expect((rows()[1] as HTMLElement).getAttribute('data-danger')).toBeNull();
  });
});
