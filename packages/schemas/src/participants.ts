import { PARTICIPATION_STATUSES, TASK_STATUSES } from '@trace/domain';
import { z } from 'zod';
import { LngLat } from './geo';
import { Mission, MissionStatus } from './missions';

export const ParticipationStatus = z.enum(PARTICIPATION_STATUSES).meta({ id: 'ParticipationStatus' });
export const TaskStatus = z.enum(TASK_STATUSES).meta({ id: 'TaskStatus' });

/** A searcher in a mission, as the commander sees them. */
export const Participant = z
  .object({
    id: z.uuid(),
    searcherId: z.uuid(),
    name: z.string(),
    /** E.164, e.g. `+972523401187` (decision 48). */
    phone: z.string(),
    callsign: z.number().int().min(0).max(99),
    status: ParticipationStatus,
    polygonId: z.uuid().nullable(),
    taskStatus: TaskStatus.nullable(),
    /** Last reported position, or null before the first GPS fix. */
    position: LngLat.nullable(),
    positionAt: z.iso.datetime({ offset: true }).nullable(),
    /** Since when the phone reports no GPS (decision 42); null while it works. */
    gpsUnavailableSince: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .meta({ id: 'Participant' });

export const ParticipantList = z.array(Participant).meta({ id: 'ParticipantList' });

/** The join code from a QR, a link or typed by hand (UC-F02). An unknown code answers 404, whatever its form. */
export const JoinParams = z.object({ code: z.string().trim().min(1).max(16).toUpperCase() });

/** What a searcher sees of a mission before confirming the join (wireframe Fm02): enough to recognise it. */
export const JoinPreview = z
  .object({
    name: z.string(),
    status: MissionStatus,
    missingPerson: z.object({ name: z.string().nullable(), age: z.number().int().nullable() }),
  })
  .meta({ id: 'JoinPreview' });

/** The signed-in searcher's own participation in a mission. */
export const OwnParticipation = z
  .object({
    id: z.uuid(),
    callsign: z.number().int().min(0).max(99),
    status: ParticipationStatus,
    polygonId: z.uuid().nullable(),
    taskStatus: TaskStatus.nullable(),
  })
  .meta({ id: 'OwnParticipation' });

/** The mission a searcher joined and their participation in it (UC-F02). */
export const JoinedMission = z
  .object({ mission: Mission, participation: OwnParticipation })
  .meta({ id: 'JoinedMission' });

/** PUT /missions/:id/participants/:participantId/assignment: the polygon the commander assigns the searcher to. */
export const AssignBody = z.object({ polygonId: z.uuid() }).meta({ id: 'AssignBody' });

/** PUT /missions/:id/participation/gps: whether the searcher's phone has GPS now (UC-S01, decision 42). */
export const GpsStatusBody = z.object({ available: z.boolean() }).meta({ id: 'GpsStatusBody' });

export const ParticipantParams = z.object({ missionId: z.uuid(), participantId: z.uuid() });

export type Participant = z.infer<typeof Participant>;
export type AssignBody = z.infer<typeof AssignBody>;
export type JoinPreview = z.infer<typeof JoinPreview>;
export type OwnParticipation = z.infer<typeof OwnParticipation>;
export type JoinedMission = z.infer<typeof JoinedMission>;
