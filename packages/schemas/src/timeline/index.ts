import { MISSION_DETAIL_FIELDS, TIMELINE_EVENT_TYPES } from '@trace/domain';
import { z } from 'zod';
import { IsoDateTime } from '../datetime';

const callsign = z.number().int().min(0).max(99);

export const MissionDetailField = z.enum(MISSION_DETAIL_FIELDS).meta({ id: 'MissionDetailField' });

export const TimelineEventType = z.enum(TIMELINE_EVENT_TYPES).meta({ id: 'TimelineEventType' });

/** Who performed the event, as they were at the time. `system` for events TRACE detects (Coverage, lost contact). */
export const TimelineActor = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('commander'), userId: z.uuid(), name: z.string() }),
    z.object({ kind: z.literal('searcher'), participantId: z.uuid(), callsign, name: z.string() }),
    z.object({ kind: z.literal('system') }),
  ])
  .meta({ id: 'TimelineActor' });

/** What the event affected, with its name at the time (polygons are renamed and deleted; history keeps the old name). */
export const TimelineSubject = z
  .object({
    kind: z.enum(['mission', 'lkp', 'polygon', 'participant', 'report', 'sos']),
    id: z.uuid(),
    label: z.string().nullable(),
    /** The searcher's callsign when the subject is a participant. */
    callsign: callsign.nullable(),
  })
  .meta({ id: 'TimelineSubject' });

const base = {
  id: z.uuid(),
  missionId: z.uuid(),
  occurredAt: IsoDateTime,
  actor: TimelineActor,
  subject: TimelineSubject,
};
const empty = z.object({});

// The issue that records a type may add fields to its details.
export const TimelineEvent = z
  .discriminatedUnion('type', [
    /** Subject: the mission (label = its name). Actor: the commander. */
    z.object({ ...base, type: z.literal('mission.created'), details: empty }),
    /** Subject: the mission. Actor: the commander. */
    z.object({ ...base, type: z.literal('mission.paused'), details: empty }),
    /** Subject: the mission. Actor: the commander. */
    z.object({ ...base, type: z.literal('mission.resumed'), details: empty }),
    /** Subject: the mission. Actor: the commander. */
    z.object({
      ...base,
      type: z.literal('mission.ended'),
      details: z.object({ outcome: z.enum(['located', 'stopped']) }),
    }),
    /**
     * Subject: the mission (label = its name after the change). Actor: the commander. Only when the commander chose to
     * notify the searchers (decisions 34, 54). `fields`: what changed, may be empty.
     */
    z.object({
      ...base,
      type: z.literal('mission.details_changed'),
      details: z.object({ fields: z.array(MissionDetailField) }),
    }),
    /** Subject: the LKP (label null). Actor: the commander or a searcher. */
    z.object({
      ...base,
      type: z.literal('lkp.changed'),
      details: z.object({ observedAt: IsoDateTime, previousObservedAt: IsoDateTime.nullable() }),
    }),
    /** Subject: the polygon (label = its name). Actor: the commander. */
    z.object({ ...base, type: z.literal('polygon.created'), details: empty }),
    /** Subject: the polygon. Actor: the commander. */
    z.object({
      ...base,
      type: z.literal('polygon.boundary_changed'),
      details: z.object({ searchersOutside: z.number().int().min(0) }),
    }),
    /** Subject: the polygon (label = its name at deletion). Actor: the commander. */
    z.object({ ...base, type: z.literal('polygon.deleted'), details: empty }),
    /** Subject: the polygon. Actor: a searcher. */
    z.object({ ...base, type: z.literal('search.started'), details: empty }),
    /** Subject: the report (label = its summary). Actor: a searcher or the commander. */
    z.object({ ...base, type: z.literal('report.submitted'), details: empty }),
    /** Subject: the polygon. Actor: the system. The thresholds are fixed in the MVP (decision 55). */
    z.object({
      ...base,
      type: z.literal('coverage.threshold_reached'),
      details: z.object({ threshold: z.union([z.literal(80), z.literal(90)]) }),
    }),
    /**
     * Subject: the participant (label = name, with callsign). Actor: the system. The searcher went Offline: no live
     * connection and no update within the threshold (UC-C10).
     */
    z.object({ ...base, type: z.literal('contact.lost'), details: empty }),
    /** Subject: the participant. Actor: the system. A searcher recorded as Offline is online again (UC-C10). */
    z.object({ ...base, type: z.literal('contact.restored'), details: empty }),
    /**
     * Subject: the participant. Actor: the system. The searcher's phone fell below the low-battery threshold (UC-S04,
     * decision 45); `level` is the reading that crossed it, in percent.
     */
    z.object({
      ...base,
      type: z.literal('battery.low'),
      details: z.object({ level: z.number().int().min(0).max(100) }),
    }),
    /** Subject: the SOS (label = polygon name or null). Actor: a searcher. */
    z.object({ ...base, type: z.literal('sos.activated'), details: z.object({ message: z.string().nullable() }) }),
    /** Subject: the SOS (label = polygon name or null). Actor: the commander, or the searcher who sent it. */
    z.object({ ...base, type: z.literal('sos.closed'), details: empty }),
  ])
  .meta({ id: 'TimelineEvent' });

export const TimelineEventList = z.array(TimelineEvent).meta({ id: 'TimelineEventList' });

export type TimelineActor = z.infer<typeof TimelineActor>;
export type TimelineSubject = z.infer<typeof TimelineSubject>;
export type TimelineEvent = z.infer<typeof TimelineEvent>;
