import { LKP_DECISIONS, SIGHTING_SOURCES, USER_ROLES } from '@trace/domain';
import { z } from 'zod';
import { PointGeometry } from '../geo';
import { Lkp } from '../missions';

export const SightingSource = z.enum(SIGHTING_SOURCES).meta({ id: 'SightingSource' });
export const LkpDecision = z.enum(LKP_DECISIONS).meta({ id: 'LkpDecision' });

// Request bodies with defaults or transforms have no OpenAPI component id: their input and output differ.

/** A new sighting (decision 61). Location, time and source are required; the description may be blank. */
export const CreateSightingBody = z.object({
  position: PointGeometry,
  observedAt: z.iso.datetime({ offset: true }),
  source: SightingSource,
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

export const Sighting = z
  .object({
    id: z.uuid(),
    missionId: z.uuid(),
    /** 1, 2, … in the order the mission's sightings were added; shown on the map and in the list. */
    number: z.number().int().min(1),
    position: PointGeometry,
    observedAt: z.iso.datetime({ offset: true }),
    description: z.string().nullable(),
    source: SightingSource,
    reportedBy: z.object({
      role: z.enum(USER_ROLES),
      name: z.string(),
      /** The searcher's callsign in this mission; null for the commander. */
      callsign: z.number().int().nullable(),
    }),
    lkpDecision: LkpDecision.nullable(),
    /** TRACE suggests making it the new LKP: undecided and later than the current LKP (decisions 59, 63). */
    lkpCandidate: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: 'Sighting' });

export const SightingList = z.array(Sighting).meta({ id: 'SightingList' });

export const SightingParams = z.object({ missionId: z.uuid(), sightingId: z.uuid() });

export const LkpDecisionBody = z.object({ decision: LkpDecision }).meta({ id: 'LkpDecisionBody' });

/** The answer to a decision: the sighting after it and the mission's current LKP (changed only when accepted). */
export const LkpDecisionResult = z.object({ sighting: Sighting, lkp: Lkp }).meta({ id: 'LkpDecisionResult' });

export type SightingSource = z.infer<typeof SightingSource>;
export type LkpDecision = z.infer<typeof LkpDecision>;
export type CreateSightingBody = z.input<typeof CreateSightingBody>;
export type Sighting = z.infer<typeof Sighting>;
export type LkpDecisionBody = z.infer<typeof LkpDecisionBody>;
export type LkpDecisionResult = z.infer<typeof LkpDecisionResult>;
