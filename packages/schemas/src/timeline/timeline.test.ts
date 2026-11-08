import { TIMELINE_EVENT_TYPES, type TimelineEventType } from '@trace/domain';
import { describe, expect, it } from 'vitest';
import { MissionEvent } from '../realtime';
import { TimelineEvent } from '.';

const ID = '5f0c2b1e-7a4d-4c1e-9a55-0d3f1b6a7c10';
const OTHER_ID = '9b1d6f52-3c8e-4f0a-8d77-2a4e5c6b7d21';
const AT = '2026-10-03T13:05:00.000Z';
const commander = { kind: 'commander', userId: ID, name: 'מנהל' } as const;
const searcher = { kind: 'searcher', participantId: OTHER_ID, callsign: 7, name: 'אלון שגיא' } as const;
const system = { kind: 'system' } as const;
const subject = (kind: string, label: string | null, callsign: number | null = null) => ({
  kind,
  id: OTHER_ID,
  label,
  callsign,
});

const samples: Record<TimelineEventType, unknown> = {
  'mission.created': { type: 'mission.created', actor: commander, subject: subject('mission', 'מסע 0412'), details: {} },
  'mission.paused': { type: 'mission.paused', actor: commander, subject: subject('mission', 'מסע 0412'), details: {} },
  'mission.resumed': { type: 'mission.resumed', actor: commander, subject: subject('mission', 'מסע 0412'), details: {} },
  'mission.ended': {
    type: 'mission.ended',
    actor: commander,
    subject: subject('mission', 'מסע 0412'),
    details: { outcome: 'located' },
  },
  'lkp.changed': {
    type: 'lkp.changed',
    actor: commander,
    subject: subject('lkp', null),
    details: { observedAt: AT, previousObservedAt: null },
  },
  'polygon.created': { type: 'polygon.created', actor: commander, subject: subject('polygon', 'ואדי'), details: {} },
  'polygon.boundary_changed': {
    type: 'polygon.boundary_changed',
    actor: commander,
    subject: subject('polygon', 'ואדי'),
    details: { searchersOutside: 2 },
  },
  'polygon.deleted': { type: 'polygon.deleted', actor: commander, subject: subject('polygon', 'ואדי'), details: {} },
  'search.started': { type: 'search.started', actor: searcher, subject: subject('polygon', 'ואדי'), details: {} },
  'report.submitted': { type: 'report.submitted', actor: searcher, subject: subject('report', 'מפגע'), details: {} },
  'coverage.threshold_reached': {
    type: 'coverage.threshold_reached',
    actor: system,
    subject: subject('polygon', 'ואדי'),
    details: { threshold: 80 },
  },
  'contact.lost': {
    type: 'contact.lost',
    actor: system,
    subject: subject('participant', 'אלון שגיא', 7),
    details: {},
  },
  'sos.activated': { type: 'sos.activated', actor: searcher, subject: subject('sos', null), details: {} },
};

const event = (sample: unknown) => ({ id: ID, missionId: OTHER_ID, occurredAt: AT, ...(sample as object) });

describe('TimelineEvent', () => {
  it.each(TIMELINE_EVENT_TYPES)('parses a %s event', (type) => {
    expect(TimelineEvent.safeParse(event(samples[type])).success).toBe(true);
  });

  it('rejects an lkp.changed event without observedAt', () => {
    const sample = { ...(samples['lkp.changed'] as object), details: { previousObservedAt: null } };
    expect(TimelineEvent.safeParse(event(sample)).success).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(TimelineEvent.safeParse(event({ ...(samples['mission.created'] as object), type: 'mission.exploded' })).success).toBe(
      false,
    );
  });

  it('rejects a Coverage threshold other than 80 or 90', () => {
    const sample = { ...(samples['coverage.threshold_reached'] as object), details: { threshold: 70 } };
    expect(TimelineEvent.safeParse(event(sample)).success).toBe(false);
  });
});

describe('MissionEvent', () => {
  it('parses a timeline.recorded event', () => {
    const recorded = { type: 'timeline.recorded', missionId: OTHER_ID, event: event(samples['polygon.created']) };
    expect(MissionEvent.safeParse(recorded).success).toBe(true);
  });
});
