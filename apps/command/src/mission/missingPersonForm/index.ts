import type { UpdateMissionDetailsBody } from '@trace/schemas';

/** The missing-person fields both mission forms hold, as the inputs hold them. */
export interface MissingPersonFields {
  personName: string;
  age: string;
  /** `YYYY-MM-DDTHH:mm` from a datetime-local input, in the commander's time zone. Empty when unknown. */
  disappearedAt: string;
  description: string;
  additionalInfo: string;
}

export const MAX_AGE = 130;
export const AGE_MESSAGE = 'גיל במספרים שלמים, 0 עד 130.';

/** The age message when a typed age is not a whole number 0–130; an empty age is fine. */
export function ageError(age: string): string | undefined {
  const text = age.trim();
  return text && !(/^\d+$/.test(text) && Number(text) <= MAX_AGE) ? AGE_MESSAGE : undefined;
}

/** The API's missing person for a valid form. Blank text becomes null. */
export function toMissingPerson(form: MissingPersonFields): UpdateMissionDetailsBody['missingPerson'] {
  const text = (value: string) => value.trim() || null;
  return {
    name: text(form.personName),
    age: form.age.trim() ? Number(form.age) : null,
    disappearedAt: form.disappearedAt ? new Date(form.disappearedAt).toISOString() : null,
    description: text(form.description),
    additionalInfo: text(form.additionalInfo),
  };
}
