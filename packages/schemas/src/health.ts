import { z } from 'zod';

export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    time: z.iso.datetime(),
  })
  .meta({ id: 'HealthResponse' });

export type HealthResponse = z.infer<typeof HealthResponse>;
