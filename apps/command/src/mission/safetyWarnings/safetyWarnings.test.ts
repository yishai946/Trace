import type { MissionPolygon, Participant, TimelineEvent } from '@trace/schemas';
import { describe, expect, it } from 'vitest';
import { safetyWarnings } from '.';

const at = '2026-10-03T13:55:00.000Z';
const dana = {
  id: 'p1',
  name: 'דנה',
  callsign: 4,
  status: 'assigned',
  gpsUnavailableSince: null,
  battery: null,
  lastUpdateAt: at,
} as Participant;

const event = (type: string, details: object = {}) =>
  ({ type, subject: { id: 'p1' }, occurredAt: '2026-10-03T14:00:00.000Z', details }) as TimelineEvent;

const titles = (participant: Participant, events: TimelineEvent[] = [], polygons: MissionPolygon[] = []) =>
  safetyWarnings({ events, participants: [participant], polygons }).map((w) => w.title);

describe('safetyWarnings', () => {
  it('warns of a lost GPS once escalated, and not after it came back', () => {
    const lost = { ...dana, gpsUnavailableSince: at };
    expect(titles(lost)).toEqual([]);
    expect(titles(lost, [event('gps.lost_escalated')])).toEqual(['GPS אבד']);
    expect(titles(dana, [event('gps.lost_escalated')])).toEqual([]);
  });

  it('warns of lost contact until a newer update', () => {
    const events = [event('contact.no_updates', { lastUpdateAt: at })];
    expect(titles(dana, events)).toEqual(['אבד קשר']);
    expect(titles({ ...dana, lastUpdateAt: '2026-10-03T14:05:00.000Z' }, events)).toEqual([]);
  });

  it('warns of a low battery below the threshold only', () => {
    expect(titles({ ...dana, battery: { level: 19, measuredAt: at } })).toEqual(['סוללה נמוכה']);
    expect(titles({ ...dana, battery: { level: 20, measuredAt: at } })).toEqual([]);
  });

  it('says nothing about a searcher whose activity ended', () => {
    expect(titles({ ...dana, status: 'ended', battery: { level: 5, measuredAt: at } })).toEqual([]);
  });

  it('warns of the highest Coverage threshold of a polygon that is not completed', () => {
    const polygon = { id: 'a', name: 'ואדי', status: 'active', coverage: 92 } as MissionPolygon;
    const warn = (p: MissionPolygon) => safetyWarnings({ events: [], participants: [], polygons: [p] });
    expect(warn(polygon).map((w) => w.message)).toEqual(['הכיסוי עבר 90%']);
    expect(warn({ ...polygon, coverage: 79 })).toEqual([]);
    expect(warn({ ...polygon, status: 'completed' })).toEqual([]);
  });
});
