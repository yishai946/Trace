import { localDateTimeOf } from '@trace/domain';
import type { LngLat } from '@trace/geo';
import type { EndMissionLocatedBody } from '@trace/schemas';

/** What the commander entered to end the mission as "the missing person was located" (UC-C16, decision 97). */
export interface EndLocatedForm {
  position: LngLat | null;
  /** `YYYY-MM-DDTHH:mm` in the commander's time zone. */
  locatedAt: string;
  note: string;
}

export type EndLocatedErrors = Partial<Record<'position' | 'locatedAt', string>>;

export const MESSAGES = {
  position: 'בחרו את המקום שבו הנעדר אותר.',
  locatedAt: 'חסרים התאריך והשעה של האיתור.',
} as const;

/** A form with the time of now, since the commander usually ends the mission just after the missing person is found. */
export const initialForm = (now = new Date()): EndLocatedForm => ({
  position: null,
  locatedAt: localDateTimeOf(now),
  note: '',
});

/** The fields to fix before the mission can end. */
export function validate(form: EndLocatedForm): EndLocatedErrors {
  const errors: EndLocatedErrors = {};
  if (!form.position) errors.position = MESSAGES.position;
  if (!form.locatedAt) errors.locatedAt = MESSAGES.locatedAt;
  return errors;
}

/** The API request for a valid form. Call `validate` first. */
export function toBody(form: EndLocatedForm): EndMissionLocatedBody {
  if (!form.position || !form.locatedAt) throw new Error('Ending a mission as located needs a place and a time');
  return {
    position: { type: 'Point', coordinates: form.position },
    locatedAt: new Date(form.locatedAt).toISOString(),
    note: form.note.trim(),
  };
}
