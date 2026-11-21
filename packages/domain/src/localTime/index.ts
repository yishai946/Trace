/** A number with leading zeros, `7` as `07`. */
export const padNumber = (value: number, length = 2): string => String(value).padStart(length, '0');

/** `HH:MM` of a date, in the device's time zone. */
export const clockOf = (date: Date): string => `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;

/** A date as a `datetime-local` value in the device's time zone: `YYYY-MM-DDTHH:mm`. */
export function localDateTimeOf(date: Date): string {
  const day = `${padNumber(date.getFullYear(), 4)}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
  return `${day}T${clockOf(date)}`;
}
