/** An Israeli mobile number as `052-340-1187`; any other number as it is. Shown left to right inside Hebrew text. */
export function formatPhone(e164: string): string {
  const match = /^\+972(5\d)(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]}-${match[2]}-${match[3]}` : e164;
}

/** The `tel:` link for an E.164 number (`+972523401187`), or `null` when the number cannot be dialed from it. */
export function telHref(e164: string): string | null {
  return /^\+[1-9]\d{6,14}$/.test(e164) ? `tel:${e164}` : null;
}

/**
 * A phone number as a person types it (`052-340-1187`, `0523401187`, `+972 52 340 1187`) in E.164 (`+972523401187`),
 * or `null` when it is not a number. A leading 0 means Israel; spaces, dashes and brackets are ignored.
 */
export function parsePhone(input: string): string | null {
  const compact = input.replace(/[\s\-()]/g, '');
  const international = /^0[2-9]\d{7,8}$/.test(compact) ? `+972${compact.slice(1)}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}
