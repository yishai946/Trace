import type { LngLat } from '@trace/geo';
import type { CreateSightingBody, SightingSource } from '@trace/schemas';

/** What the commander entered for a new sighting (decision 61). The position comes from a click on the map. */
export interface SightingForm {
  /** No default: a sighting without a source is refused. */
  source: SightingSource | null;
  position: LngLat | null;
  /** `YYYY-MM-DDTHH:mm` in the commander's time zone. */
  observedAt: string;
  description: string;
}

export type SightingFormErrors = Partial<Record<'position' | 'observedAt' | 'source', string>>;

export const MESSAGES = {
  position: 'בחרו מיקום במפה.',
  observedAt: 'חסרים התאריך והשעה של התצפית.',
  source: 'בחרו מקור: אני או עד ראייה.',
} as const;

export const emptyForm: SightingForm = { source: null, position: null, observedAt: '', description: '' };

const two = (value: number) => String(value).padStart(2, '0');

/** The local date and time as the date field holds it, to the minute. */
export const nowLocal = (date = new Date()) =>
  `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;

/** The fields to fix before the sighting can be saved. */
export function validate(form: SightingForm): SightingFormErrors {
  const errors: SightingFormErrors = {};
  if (!form.position) errors.position = MESSAGES.position;
  if (!form.observedAt) errors.observedAt = MESSAGES.observedAt;
  if (!form.source) errors.source = MESSAGES.source;
  return errors;
}

/** The API request for a valid form. Call `validate` first. */
export function toCreateBody(form: SightingForm): CreateSightingBody {
  if (!form.position || !form.source || !form.observedAt)
    throw new Error('A sighting needs a location, time and source');
  return {
    position: { type: 'Point', coordinates: form.position },
    observedAt: new Date(form.observedAt).toISOString(),
    source: form.source,
    description: form.description.trim(),
  };
}
