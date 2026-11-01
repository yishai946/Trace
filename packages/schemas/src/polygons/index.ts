import { POLYGON_STATUSES } from '@trace/domain';
import { z } from 'zod';
import { PolygonGeometry } from '../geo';

export const PolygonStatus = z.enum(POLYGON_STATUSES).meta({ id: 'PolygonStatus' });

const PolygonName = z
  .string()
  .trim()
  .max(60)
  .transform((value) => value || null);

export const MissionPolygon = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    /** Assigned by the server: A, B, … in creation order, never reused. */
    letter: z.string(),
    name: z.string().nullable(),
    status: PolygonStatus,
    /** Coverage estimate in percent, computed from search routes; null before any searching. Never set by hand. */
    coverage: z.number().min(0).max(100).nullable(),
    /** Searchers assigned to the polygon. While above zero the polygon cannot be deleted. */
    activeSearchers: z.number().int().min(0),
    geometry: PolygonGeometry,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: 'MissionPolygon' });

export const MissionPolygonList = z.array(MissionPolygon).meta({ id: 'MissionPolygonList' });

// Request bodies with defaults or transforms have no OpenAPI component id: their input and output differ.
export const CreatePolygonBody = z.object({ geometry: PolygonGeometry, name: PolygonName.nullable().optional() });

export const UpdatePolygonBody = z
  .object({
    geometry: PolygonGeometry.optional(),
    name: PolygonName.nullable().optional(),
    /** Saves a boundary that leaves active searchers outside, after the commander saw the warning (UC-C06). */
    confirmSearchersOutside: z.boolean().default(false),
  })
  .refine((body) => body.geometry !== undefined || body.name !== undefined, {
    message: 'Nothing to update: send geometry or name',
  });

export const PolygonParams = z.object({ missionId: z.uuid(), polygonId: z.uuid() });

/** `details` of a SEARCHERS_OUTSIDE_POLYGON error. */
export const SearchersOutsideDetails = z
  .object({
    searchers: z.array(
      z.object({
        participantId: z.uuid(),
        callsign: z.number().int(),
        name: z.string(),
        meters: z.number().min(0),
      }),
    ),
  })
  .meta({ id: 'SearchersOutsideDetails' });

export type PolygonStatus = z.infer<typeof PolygonStatus>;
export type MissionPolygon = z.infer<typeof MissionPolygon>;
export type CreatePolygonBody = z.input<typeof CreatePolygonBody>;
export type UpdatePolygonBody = z.input<typeof UpdatePolygonBody>;
export type SearchersOutsideDetails = z.infer<typeof SearchersOutsideDetails>;
