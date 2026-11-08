import type { Mission, UpdateMissionDetailsBody } from '@trace/schemas';
import { ApiRequestError } from '../../../api';

/** What the commander edits on the mission details screen, as the inputs hold it. */
export interface MissionDetailsForm {
  name: string;
  personName: string;
  age: string;
  /** `YYYY-MM-DDTHH:mm` in the commander's time zone, or empty. */
  disappearedAt: string;
  description: string;
  additionalInfo: string;
}

export type DetailsErrors = Partial<Record<'name' | 'age', string>>;

export const DETAILS_MESSAGES = {
  name: 'חסר שם או מזהה למסע.',
  age: 'גיל במספרים שלמים, 0 עד 130.',
} as const;

export const PHOTO_SAVE_FAILED = 'הפרטים נשמרו, אבל התמונה לא נשמרה. נסו שוב.';

const MAX_AGE = 130;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** An ISO time as a datetime-local value in the commander's time zone: `YYYY-MM-DDTHH:mm`. Empty for null. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The form filled with the mission as saved. Missing values are empty. */
export function fromMission(mission: Mission): MissionDetailsForm {
  const { missingPerson } = mission;
  return {
    name: mission.name,
    personName: missingPerson.name ?? '',
    age: missingPerson.age === null ? '' : String(missingPerson.age),
    disappearedAt: toLocalInput(missingPerson.disappearedAt),
    description: missingPerson.description ?? '',
    additionalInfo: missingPerson.additionalInfo ?? '',
  };
}

/** The fields to fix before saving: a mission name, and an age that is a whole number 0–130. */
export function validate(form: MissionDetailsForm): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!form.name.trim()) errors.name = DETAILS_MESSAGES.name;
  const age = form.age.trim();
  if (age && !(/^\d+$/.test(age) && Number(age) <= MAX_AGE)) errors.age = DETAILS_MESSAGES.age;
  return errors;
}

/** The API request for a valid form. Blank text becomes null. */
export function toUpdateBody(form: MissionDetailsForm): UpdateMissionDetailsBody {
  const text = (value: string) => value.trim() || null;
  return {
    name: form.name.trim(),
    missingPerson: {
      name: text(form.personName),
      age: form.age.trim() ? Number(form.age) : null,
      disappearedAt: form.disappearedAt ? new Date(form.disappearedAt).toISOString() : null,
      description: text(form.description),
      additionalInfo: text(form.additionalInfo),
    },
  };
}

const normalise = (form: MissionDetailsForm): MissionDetailsForm => ({
  name: form.name.trim(),
  personName: form.personName.trim(),
  age: form.age.trim(),
  disappearedAt: form.disappearedAt,
  description: form.description.trim(),
  additionalInfo: form.additionalInfo.trim(),
});

/** Whether the form differs from the mission as saved (trimmed text compared). */
export function isChanged(form: MissionDetailsForm, mission: Mission): boolean {
  return JSON.stringify(normalise(form)) !== JSON.stringify(normalise(fromMission(mission)));
}

const SAVE_ERRORS: Record<string, string> = {
  NETWORK_ERROR: 'אין חיבור לשרת. השינויים לא נשמרו.',
  MISSION_ENDED: 'המסע הסתיים. אי אפשר לשמור שינויים.',
  VALIDATION_ERROR: 'הפרטים אינם תקינים. בדקו את השדות ונסו שוב.',
  FORBIDDEN: 'המסע לא זמין לשינוי. רעננו את המסך.',
  NOT_FOUND: 'המסע לא זמין לשינוי. רעננו את המסך.',
};

/** A Hebrew message for a failed save. */
export function saveErrorMessage(error: unknown): string {
  const known = error instanceof ApiRequestError ? SAVE_ERRORS[error.code] : undefined;
  return known ?? 'השינויים לא נשמרו. נסו שוב.';
}
