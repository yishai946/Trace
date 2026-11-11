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
