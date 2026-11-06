import type { LngLat } from '@trace/geo';
import type { CreateMissionBody } from '@trace/schemas';

/** What the commander typed on the new-mission screen, as the inputs hold it. */
export interface NewMissionForm {
  name: string;
  personName: string;
  age: string;
  /** `YYYY-MM-DDTHH:mm` from a datetime-local input, in the commander's time zone. Empty when unknown. */
  disappearedAt: string;
  description: string;
  additionalInfo: string;
  lkp: LngLat | null;
  /** `YYYY-MM-DDTHH:mm` from a datetime-local input: when the missing person was at the LKP. */
  lkpObservedAt: string;
  rally: LngLat | null;
}

export const emptyForm: NewMissionForm = {
  name: '',
  personName: '',
  age: '',
  disappearedAt: '',
  description: '',
  additionalInfo: '',
  lkp: null,
  lkpObservedAt: '',
  rally: null,
};

export type FormErrors = Partial<Record<'name' | 'age' | 'lkp' | 'lkpObservedAt' | 'rally', string>>;

export const MESSAGES = {
  name: 'חסר שם או מזהה למסע.',
  age: 'גיל במספרים שלמים, 0 עד 130.',
  lkp: 'חסר LKP — חובה לפני יצירת המסע.',
  lkpObservedAt: 'חסרים התאריך והשעה שבהם נראה ב-LKP.',
  rally: 'חסרה נקודת כינוס — חובה לפני יצירת המסע.',
} as const;

const MAX_AGE = 130;

/** The fields to fix before the mission can be created (UC-C02): the name, the LKP with its time, the rally point. */
export function validate(form: NewMissionForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = MESSAGES.name;
  const age = form.age.trim();
  if (age && !(/^\d+$/.test(age) && Number(age) <= MAX_AGE)) errors.age = MESSAGES.age;
  if (!form.lkp) errors.lkp = MESSAGES.lkp;
  else if (!form.lkpObservedAt) errors.lkpObservedAt = MESSAGES.lkpObservedAt;
  if (!form.rally) errors.rally = MESSAGES.rally;
  return errors;
}

/** The API request for a valid form. Call `validate` first. */
export function toCreateBody(form: NewMissionForm): CreateMissionBody {
  if (!form.rally || !form.lkp) throw new Error('A mission needs a rally point and an LKP');
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
    rallyPoint: { type: 'Point', coordinates: form.rally },
    lkp: { position: { type: 'Point', coordinates: form.lkp }, observedAt: new Date(form.lkpObservedAt).toISOString() },
  };
}

/** Latitude and longitude typed by hand, or null unless both are numbers on the globe. */
export function parseLatLng(lat: string, lng: string): LngLat | null {
  if (!lat.trim() || !lng.trim()) return null;
  const latitude = Number(lat.trim());
  const longitude = Number(lng.trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [longitude, latitude];
}

/** A coordinate for the latitude and longitude fields: five decimals, about a metre. */
export const formatCoordinate = (value: number) => String(Number(value.toFixed(5)));
