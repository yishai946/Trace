import { z } from 'zod';

/** The name a searcher enters on first sign-in (UC-F01, decision 48). */
export const SearcherName = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(60)
  .refine((name) => !name.includes('\u0000'), 'Name has an invalid character');

/** The signed-in searcher's own profile. */
export const SearcherProfile = z
  .object({ id: z.uuid(), phone: z.string(), name: z.string() })
  .meta({ id: 'SearcherProfile' });

/** PUT /api/searchers/me: the searcher's name. */
export const SaveSearcherProfileBody = z.object({ name: SearcherName }).meta({ id: 'SaveSearcherProfileBody' });

export type SearcherProfile = z.infer<typeof SearcherProfile>;
export type SaveSearcherProfileBody = z.infer<typeof SaveSearcherProfileBody>;
