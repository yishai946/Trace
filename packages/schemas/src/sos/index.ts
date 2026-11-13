import { SOS_STATUSES, USER_ROLES } from '@trace/domain';
import { z } from 'zod';
import { PointGeometry } from '../geo';

export const SosStatus = z.enum(SOS_STATUSES).meta({ id: 'SosStatus' });

/** The longest message an SOS carries (UC-F13: a short message). */
export const SOS_MESSAGE_MAX_LENGTH = 500;

/** Where the searcher was when they sent the SOS. */
export const SosLocation = z
  .object({
    position: PointGeometry,
    recordedAt: z.iso.datetime({ offset: true }),
    /** Meters; null when the phone gave none. */
    accuracy: z.number().nullable(),
  })
  .meta({ id: 'SosLocation' });

// Request bodies with defaults or transforms have no OpenAPI component id: their input and output differ.

/**
 * Activating an SOS (UC-F13). Both fields are optional: the SOS is sent even with no message and no GPS. Without a
 * location the API uses the searcher's last known position.
 */
export const CreateSosBody = z.object({
  message: z
    .string()
    .trim()
    .max(SOS_MESSAGE_MAX_LENGTH)
    .transform((value) => value || null)
    .nullable()
    .default(null),
  location: z
    .object({
      position: PointGeometry,
      recordedAt: z.iso.datetime({ offset: true }),
      accuracy: z.number().min(0).max(100_000).nullable().default(null),
    })
    .nullable()
    .default(null),
});

export const Sos = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    status: SosStatus,
    sender: z.object({
      participantId: z.uuid(),
      searcherId: z.uuid(),
      callsign: z.number().int().min(0).max(99),
      name: z.string(),
    }),
    /** The sender's polygon when it was sent; null for a searcher who had none. */
    polygon: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    message: z.string().nullable(),
    location: SosLocation.nullable(),
    /** How many searchers it was sent to (the sender's polygon, without the sender); the commander always gets it. */
    recipientCount: z.number().int().min(0),
    activatedAt: z.iso.datetime({ offset: true }),
    closedAt: z.iso.datetime({ offset: true }).nullable(),
    closedBy: z.object({ role: z.enum(USER_ROLES), name: z.string() }).nullable(),
  })
  .meta({ id: 'Sos' });

export const SosList = z.array(Sos).meta({ id: 'SosList' });

export const SosParams = z.object({ missionId: z.uuid(), sosId: z.uuid() });

export type SosStatus = z.infer<typeof SosStatus>;
export type SosLocation = z.infer<typeof SosLocation>;
export type CreateSosBody = z.input<typeof CreateSosBody>;
export type Sos = z.infer<typeof Sos>;
