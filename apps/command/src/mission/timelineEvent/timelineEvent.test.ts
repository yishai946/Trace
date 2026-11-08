import { TIMELINE_EVENT_TYPES } from '@trace/domain';
import type { TimelineEvent } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { eventSamples } from '../fixtures';
import { CATEGORY_OF, TIMELINE_CATEGORIES, describeEvent, formatEventTime, spansDays } from '.';

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

  it('words the events whose actions come later', () => {
    expect(text(eventSamples['mission.paused'])).toBe('המסע הושהה');
    expect(text(eventSamples['mission.resumed'])).toBe('המסע חודש');
    expect(text(eventSamples['mission.ended'])).toBe('המסע הסתיים, הנעדר אותר');
    expect(text(withDetails(eventSamples['mission.ended'], { outcome: 'stopped' }))).toBe('המסע הסתיים, החיפוש הופסק');
    expect(text(eventSamples['search.started'])).toBe('[7] אלון שגיא התחיל חיפוש בחורשת אורנים');
    expect(text(eventSamples['report.submitted'])).toBe('מפגע, מדרון חלק, מ-[7] אלון שגיא');
    expect(text(eventSamples['coverage.threshold_reached'])).toBe('ואדי צפוני הגיע ל-80% Coverage');
    expect(text(eventSamples['contact.lost'])).toBe('אבד קשר עם [7] אלון שגיא');
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
  const iso = new Date(2026, 9, 3, 16, 58).toISOString();

  it('shows the time in 24 hours, with the date when asked', () => {
    expect(formatEventTime(iso, false)).toBe('16:58');
    expect(formatEventTime(iso, true)).toBe('03.10, 16:58');
  });
});

describe('spansDays', () => {
  const at = (day: number, hour: number): TimelineEvent => ({
    ...eventSamples['polygon.created'],
    occurredAt: new Date(2026, 9, day, hour).toISOString(),
  });

  it('is true when the first and last events fall on different days', () => {
    expect(spansDays([at(3, 23), at(4, 1)])).toBe(true);
  });

  it('is false within one day, and for no events', () => {
    expect(spansDays([at(3, 1), at(3, 23)])).toBe(false);
    expect(spansDays([])).toBe(false);
  });
});
