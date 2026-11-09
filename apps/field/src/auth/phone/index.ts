/** The server accepts E.164 only: a plus sign, a country code and up to 15 digits (`apps/api/src/auth`). */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * The number as the API wants it, from what a searcher types: an Israeli mobile number (05X…) or any international
 * number starting with `+`. Null when it is neither.
 */
export function toE164(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const local = /^0(5\d{8})$/.exec(digits) ?? /^972(5\d{8})$/.exec(digits);
  if (local) return `+972${local[1]}`;
  return E164.test(digits) ? digits : null;
}

/** An Israeli mobile number as `052-340-1187`; any other number as it is. Wrap the result in `ltr()` inside Hebrew text. */
export function formatPhone(e164: string): string {
  const match = /^\+972(5\d)(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]}-${match[2]}-${match[3]}` : e164;
}
