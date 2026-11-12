import type { LngLat } from '@trace/geo';
import type { SightingSource } from '@trace/schemas';
import type { QueuedSighting } from '../sender';

/** Where the sighting happened: the searcher's own position, or a point picked on the map (Fm09). */
export type LocationMode = 'mine' | 'map';

/** What the searcher entered in the sighting form, before it is checked. */
export interface SightingDraft {
  source: SightingSource;
  position: LngLat | null;
  /** The time of day as typed, `HH:MM` (Fm09). */
  clock: string;
  description: string;
}

export interface DraftErrors {
  position?: string;
  clock?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `HH:MM` of a date, in the phone's time zone. */
export const clockOf = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Hours and minutes of a typed time such as `16:58`, or null when it is not a time of day. */
export function parseClock(text: string): { hours: number; minutes: number } | null {
  const match = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(text);
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

/**
 * The moment a typed time of day means: today in the phone's time zone, or yesterday when that would be later than
 * `now`, since a sighting is never in the future.
 */
export function observedAtOf(clock: string, now: Date): Date | null {
  const time = parseClock(clock);
  if (!time) return null;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hours, time.minutes, 0, 0);
  if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
  return at;
}

/** The request body for the draft, or the errors to show. Both errors are reported together. */
export function toSighting(
  draft: SightingDraft,
  { now, id }: { now: Date; id: string },
): { sighting: QueuedSighting } | { errors: DraftErrors } {
  const observedAt = observedAtOf(draft.clock, now);
  const errors: DraftErrors = {};
  if (!draft.position) errors.position = 'בחר את מקום התצפית במפה, או המתן למיקום שלך.';
  if (!observedAt) errors.clock = 'הזן שעה כמו 16:58.';
  if (!draft.position || !observedAt) return { errors };
  return {
    sighting: {
      id,
      position: { type: 'Point', coordinates: draft.position },
      observedAt: observedAt.toISOString(),
      source: draft.source,
      description: draft.description.trim() || null,
    },
  };
}
