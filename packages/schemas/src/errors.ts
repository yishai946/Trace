import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'MISSION_NOT_ACTIVE',
  'MISSION_ENDED',
  'MISSION_FULL',
  'PARTICIPATION_ENDED',
  'POLYGON_NOT_FOUND',
  'INVALID_GEOMETRY',
  'POLYGON_HAS_ACTIVE_SEARCHERS',
  'SEARCHERS_OUTSIDE_POLYGON',
  'UNSUPPORTED_PHOTO',
  'PHOTO_TOO_LARGE',
  'SIGHTING_NOT_LKP_CANDIDATE',
  /** The id belongs to a sighting of another reporter or mission. */
  'SIGHTING_ID_TAKEN',
  /** No active searcher matches the message's target. */
  'NO_RECIPIENTS',
  /** Only a critical message can be acknowledged (decision 27). */
  'MESSAGE_NOT_CRITICAL',
  'INTERNAL_ERROR',
] as const;

export const ErrorCode = z.enum(ERROR_CODES).meta({ id: 'ErrorCode' });

/** The one error shape every endpoint returns. `details` depends on `code`. */
export const ApiError = z
  .object({
    error: z.object({
      code: ErrorCode,
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ApiError' });

export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiError = z.infer<typeof ApiError>;
