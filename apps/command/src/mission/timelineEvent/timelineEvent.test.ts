import { TIMELINE_EVENT_TYPES } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { eventSamples, lkpMovedEvent } from '../fixtures';
import {
  CATEGORY_OF,
  TIMELINE_CATEGORIES,
  describeEvent,
  formatEventTime,
  recentChanges,
  spansDays,
  spansDaysOf,
} from '.';

const text = (event: TimelineEvent) =>
  describeEvent(event)
    .segments.map((s) => (typeof s === 'string' ? s : `[${s.callsign}]`))
    .join('');

const withDetails = <T extends TimelineEvent>(event: T, details: object): TimelineEvent =>
  ({ ...event, details }) as TimelineEvent;

describe('describeEvent', () => {
  it('words the mission and polygon events', () => {
    expect(text(eventSamples['mission.created'])).toBe('המסע נוצר, מסע 0412');
    expect(text(eventSamples['polygon.created'])).toBe('ואדי צפוני נוצר');
    expect(text(eventSamples['polygon.deleted'])).toBe('פוליגון 2 נמחק מהמפה');
  });

  it('words a change of the mission details by what changed, with no destination', () => {
    const view = describeEvent(eventSamples['mission.details_changed']);
    expect(view).toMatchObject({ badge: 'פרטי מסע', danger: false, destination: null });
    expect(text(eventSamples['mission.details_changed'])).toBe('עודכנו: תיאור / לבוש, מידע רלוונטי');
    expect(CATEGORY_OF['mission.details_changed']).toBe('mission');
  });

  it('says whether the LKP was set or updated', () => {
    expect(text(eventSamples['lkp.changed'])).toBe('LKP נקבע ראשונית');
    const updated = withDetails(eventSamples['lkp.changed'], {
      observedAt: '2026-10-03T12:00:00.000Z',
      previousObservedAt: '2026-10-03T10:00:00.000Z',
    });
    expect(text(updated)).toBe(
      `LKP עודכן ל-${formatEventTime('2026-10-03T12:00:00.000Z', false)}, קודם ${formatEventTime('2026-10-03T10:00:00.000Z', false)}`,
    );
  });

  it('counts the searchers left outside a changed boundary', () => {
    const changed = eventSamples['polygon.boundary_changed'];
    expect(text(changed)).toBe('הגבול של ואדי צפוני שונה');
    expect(text(withDetails(changed, { searchersOutside: 1 }))).toBe('הגבול של ואדי צפוני שונה, מחפש אחד מחוץ לגבול');
    expect(text(withDetails(changed, { searchersOutside: 3 }))).toBe('הגבול של ואדי צפוני שונה, 3 מחפשים מחוץ לגבול');
  });

  it('marks SOS as danger and starts it with the callsign', () => {
    const sos = describeEvent(eventSamples['sos.activated']);
    expect(sos.danger).toBe(true);
    expect(sos.badge).toBe('SOS');
    expect(sos.segments[0]).toEqual({ callsign: 7 });
    expect(text(eventSamples['sos.activated'])).toBe('[7] אלון שגיא הפעיל SOS, חורשת אורנים');
  });

  it('words a closed SOS with who closed it, and not as danger', () => {
    expect(describeEvent(eventSamples['sos.closed']).danger).toBe(false);
    expect(text(eventSamples['sos.closed'])).toBe('מנהל סגר את ה-SOS, חורשת אורנים');
    const bySender = { ...eventSamples['sos.activated'], type: 'sos.closed' as const, details: {} };
    expect(text(bySender)).toBe('[7] אלון שגיא סגר את ה-SOS, חורשת אורנים');
  });

  it('names whose SOS the commander closed, when the sender is known', () => {
    const closed = eventSamples['sos.closed'];
    const senderOf = (id: string) => (id === closed.subject.id ? { callsign: 7, name: 'אלון שגיא' } : undefined);
    const view = describeEvent(closed, senderOf);
    expect(view.segments.map((s) => (typeof s === 'string' ? s : `[${s.callsign}]`)).join('')).toBe(
      'מנהל סגר את ה-SOS של [7] אלון שגיא, חורשת אורנים',
    );
    expect(text(closed)).toBe('מנהל סגר את ה-SOS, חורשת אורנים');
    expect(describeEvent(closed, () => undefined).segments).toEqual(describeEvent(closed).segments);
  });

  it('words the events whose actions come later', () => {
    expect(text(eventSamples['mission.paused'])).toBe('המסע הושהה');
    expect(text(eventSamples['mission.resumed'])).toBe('המסע חודש');
    expect(text(eventSamples['mission.ended'])).toBe('המסע הסתיים, הנעדר אותר');
    expect(text(withDetails(eventSamples['mission.ended'], { outcome: 'stopped' }))).toBe('המסע הסתיים, החיפוש הופסק');
    expect(text(withDetails(eventSamples['mission.ended'], { outcome: 'stopped', reason: 'weather' }))).toBe(
      'המסע הסתיים, החיפוש הופסק: מזג אוויר ותנאי שטח',
    );
    expect(text(eventSamples['search.started'])).toBe('[7] אלון שגיא התחיל חיפוש בחורשת אורנים');
    expect(text(eventSamples['report.submitted'])).toBe('מפגע, מדרון חלק, מ-[7] אלון שגיא');
    expect(text(eventSamples['coverage.threshold_reached'])).toBe('ואדי צפוני הגיע ל-80% Coverage');
    expect(text(eventSamples['contact.lost'])).toBe('אבד קשר עם [7] אלון שגיא');
    expect(text(eventSamples['contact.restored'])).toBe('הקשר עם [7] אלון שגיא חזר');
    expect(text(eventSamples['gps.lost_escalated'])).toBe('אין GPS אצל [7] אלון שגיא מ-16:50');
    expect(text(eventSamples['contact.no_updates'])).toBe('אין עדכונים מ-[7] אלון שגיא מאז 16:50');
    expect(text(eventSamples['battery.low'])).toBe('הסוללה של [7] אלון שגיא נמוכה, 19%');
  });

  it('words leaving the polygon as a warning with the distance, and the return as plain', () => {
    expect(text(eventSamples['searcher.left_polygon'])).toBe('[7] אלון שגיא יצא מהגבול של ואדי צפוני, 80 מ׳ מחוץ לו');
    expect(describeEvent(eventSamples['searcher.left_polygon'])).toMatchObject({ badge: 'גבול', warning: true });
    expect(text(eventSamples['searcher.returned_to_polygon'])).toBe('[7] אלון שגיא חזר לגבול של ואדי צפוני');
    expect(describeEvent(eventSamples['searcher.returned_to_polygon']).warning).toBe(false);
  });

  it('marks only a warning event, never an SOS, as a warning', () => {
    expect(describeEvent(eventSamples['sos.activated'])).toMatchObject({ danger: true, warning: false });
  });

  it('gives every type a badge and a category', () => {
    const categories = new Set(TIMELINE_CATEGORIES.map((c) => c.id));
    for (const type of TIMELINE_EVENT_TYPES) {
      expect(describeEvent(eventSamples[type]).badge, type).not.toBe('');
      expect(categories.has(CATEGORY_OF[type]), type).toBe(true);
    }
  });

  it('leads to the map only for LKP and polygon creation or reshaping', () => {
    const toMap = TIMELINE_EVENT_TYPES.filter((type) => describeEvent(eventSamples[type]).destination === 'map');
    expect(toMap).toEqual(['lkp.changed', 'polygon.created', 'polygon.boundary_changed']);
  });
});

describe('formatEventTime', () => {
  // 13:58 UTC is 16:58 in Israel (UTC+3 on 3 October 2026).
  const iso = '2026-10-03T13:58:00.000Z';

  it('shows the time in 24 hours, with the date when asked', () => {
    expect(formatEventTime(iso, false)).toBe('16:58');
    expect(formatEventTime(iso, true)).toBe('03.10, 16:58');
  });

  it('shows Israel time whatever the time zone of the computer', () => {
    expect(formatEventTime('2026-10-03T21:30:00.000Z', true)).toBe('04.10, 00:30');
  });
});

describe('spansDays', () => {
  const at = (day: number, hour: number): TimelineEvent => ({
    ...eventSamples['polygon.created'],
    occurredAt: new Date(Date.UTC(2026, 9, day, hour - 3)).toISOString(),
  });

  it('is true when the first and last events fall on different days', () => {
    expect(spansDays([at(3, 23), at(4, 1)])).toBe(true);
  });

  it('is false within one day, and for no events', () => {
    expect(spansDays([at(3, 1), at(3, 23)])).toBe(false);
    expect(spansDays([])).toBe(false);
  });
});

describe('recentChanges', () => {
  const moved = lkpMovedEvent;

  it('keeps the details changes and the LKP that moved, newest first', () => {
    const history = [
      eventSamples['mission.created'],
      moved,
      eventSamples['polygon.created'],
      eventSamples['mission.details_changed'],
    ];
    expect(recentChanges(history).map((event) => event.type)).toEqual(['mission.details_changed', 'lkp.changed']);
    expect(history).toHaveLength(4);
  });

  it('leaves out the LKP set when the mission was created', () => {
    expect(recentChanges([eventSamples['mission.created'], eventSamples['lkp.changed']])).toEqual([]);
  });
});

describe('spansDaysOf', () => {
  it('compares Israel days, not UTC days', () => {
    expect(spansDaysOf(['2026-11-08T21:50:00Z', '2026-11-08T22:15:00Z'])).toBe(true);
    expect(spansDaysOf(['2026-11-08T10:00:00Z', '2026-11-08T11:00:00Z'])).toBe(false);
  });
});
