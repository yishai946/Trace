import { z } from 'zod';

/** An Expo push token, in the two forms Expo issues (the same prefixes `Expo.isExpoPushToken` accepts). */
export const ExpoPushToken = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[^\]\s]+\]$/)
  .meta({ id: 'ExpoPushToken' });

export const RegisterPushTokenBody = z.object({ token: ExpoPushToken }).meta({ id: 'RegisterPushTokenBody' });
export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBody>;

/** What a push notification carries so Field can open the right screen when it is tapped. */
export const PushData = z
  .object({ missionId: z.uuid(), screen: z.enum(['map', 'messages', 'sos']) })
  .meta({ id: 'PushData' });
export type PushData = z.infer<typeof PushData>;
