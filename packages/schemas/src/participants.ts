import { PARTICIPATION_STATUSES, TASK_STATUSES } from '@trace/domain';
import { z } from 'zod';
import { LngLat } from './geo';

export const ParticipationStatus = z.enum(PARTICIPATION_STATUSES).meta({ id: 'ParticipationStatus' });
export const TaskStatus = z.enum(TASK_STATUSES).meta({ id: 'TaskStatus' });

/** A searcher in a mission, as the commander sees them. */
export const Participant = z
  .object({
    id: z.uuid(),
    searcherId: z.uuid(),
    name: z.string(),
    callsign: z.number().int().min(0).max(99),
    status: ParticipationStatus,
    polygonId: z.uuid().nullable(),
    taskStatus: TaskStatus.nullable(),
    /** Last reported position, or null before the first GPS fix. */
    position: LngLat.nullable(),
    positionAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .meta({ id: 'Participant' });

export const ParticipantList = z.array(Participant).meta({ id: 'ParticipantList' });

export type Participant = z.infer<typeof Participant>;
