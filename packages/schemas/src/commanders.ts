import { parsePhone } from '@trace/domain';
import { z } from 'zod';

/** A phone number typed by a person, saved as E.164. Anything that is not a phone number is a validation error. */
const TypedPhone = z
  .string()
  .max(30)
  .transform((value, ctx) => {
    const e164 = parsePhone(value);
    if (e164 === null) ctx.addIssue({ code: 'custom', message: 'Not a valid phone number' });
    return e164 ?? z.NEVER;
  });

/** PUT /api/me/phone: the commander's own phone number, or `null` to remove it. */
export const SetOwnPhoneBody = z.object({ phoneNumber: TypedPhone.nullable() }).meta({ id: 'SetOwnPhoneBody' });

/** The commander's phone number as saved (E.164), or `null` while none is set. */
export const OwnPhone = z.object({ phoneNumber: z.string().nullable() }).meta({ id: 'OwnPhone' });

export type SetOwnPhoneBody = z.infer<typeof SetOwnPhoneBody>;
export type OwnPhone = z.infer<typeof OwnPhone>;
