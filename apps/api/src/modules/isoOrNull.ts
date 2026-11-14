/** A date as ISO text, or null when there is none. */
export const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);
