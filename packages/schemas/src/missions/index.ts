import { MISSION_STATUSES } from '@trace/domain';
import { z } from 'zod';
import { PointGeometry } from '../geo';

export const MissionStatus = z.enum(MISSION_STATUSES).meta({ id: 'MissionStatus' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .default(null);

// Request bodies with defaults or transforms have no OpenAPI component id: their input and output differ.

/** Missing-person details from the new-mission screen (UC-C02). The photo comes with file storage. */
export const MissingPersonInput = z.object({
  name: optionalText(120),
  age: z.number().int().min(0).max(130).nullable().default(null),
  disappearedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  description: optionalText(2000),
  additionalInfo: optionalText(2000),
});

export const MissingPerson = z
  .object({
    name: z.string().nullable(),
    age: z.number().int().nullable(),
    disappearedAt: z.iso.datetime({ offset: true }).nullable(),
    description: z.string().nullable(),
    additionalInfo: z.string().nullable(),
  })
  .meta({ id: 'MissingPerson' });

export const Lkp = z
  .object({ position: PointGeometry, observedAt: z.iso.datetime({ offset: true }) })
  .meta({ id: 'Lkp' });

/** A new mission starts active. The rally point is required (decision 91); the LKP may come later (UC-C04). */
export const CreateMissionBody = z.object({
  name: z.string().trim().min(1, 'Mission name is required').max(120),
  missingPerson: MissingPersonInput.prefault({}),
  rallyPoint: PointGeometry,
  lkp: Lkp.optional(),
});

export const Mission = z
  .object({
    id: z.uuid(),
    name: z.string(),
    status: MissionStatus,
    joinCode: z.string(),
    missingPerson: MissingPerson,
    rallyPoint: PointGeometry,
    /** The current LKP; earlier ones are kept as history. */
    lkp: Lkp.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: 'Mission' });

export const MissionList = z.array(Mission).meta({ id: 'MissionList' });

export const MissionParams = z.object({ missionId: z.uuid() });

export type MissionStatus = z.infer<typeof MissionStatus>;
export type MissingPerson = z.infer<typeof MissingPerson>;
export type CreateMissionBody = z.input<typeof CreateMissionBody>;
export type Mission = z.infer<typeof Mission>;
