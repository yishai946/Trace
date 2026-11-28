import { z } from 'zod';
import { IsoDateTime } from '../datetime';
import { ParticipationStatus, TaskStatus } from '../participants';
import { ReportList } from '../reports';
import { SightingList } from '../sightings';

/**
 * What the signed-in searcher did in an ended mission (UC-F17, decision 95): their own participation, reports and
 * sightings. Nothing of other searchers is included.
 */
export const OwnActivity = z
  .object({
    callsign: z.number().int().min(0).max(99),
    joinedAt: IsoDateTime,
    status: ParticipationStatus,
    taskStatus: TaskStatus.nullable(),
    /** The polygon the searcher was assigned to when the mission ended; null when they had none. */
    polygon: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    /** Newest first. */
    reports: ReportList,
    /** Oldest first, with the mission-wide numbers. */
    sightings: SightingList,
  })
  .meta({ id: 'OwnActivity' });

/** One stretch of a searcher at a polygon (UC-C09, decision 53). */
export const AssignmentRecord = z
  .object({
    id: z.uuid(),
    participantId: z.uuid(),
    callsign: z.number().int().min(0).max(99),
    name: z.string(),
    polygonId: z.uuid(),
    polygonName: z.string(),
    assignedAt: IsoDateTime,
    /** When the searcher was moved or the mission ended for them; null while it is the current assignment. */
    endedAt: IsoDateTime.nullable(),
  })
  .meta({ id: 'AssignmentRecord' });

/** GET /missions/:id/assignments: every assignment of the mission, oldest first. */
export const AssignmentRecordList = z.array(AssignmentRecord).meta({ id: 'AssignmentRecordList' });

export type AssignmentRecord = z.infer<typeof AssignmentRecord>;
export type OwnActivity = z.infer<typeof OwnActivity>;
