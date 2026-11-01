import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'MISSION_NOT_ACTIVE',
  'INVALID_GEOMETRY',
  'POLYGON_HAS_ACTIVE_SEARCHERS',
  'SEARCHERS_OUTSIDE_POLYGON',
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
