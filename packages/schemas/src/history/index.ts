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

export type OwnActivity = z.infer<typeof OwnActivity>;
