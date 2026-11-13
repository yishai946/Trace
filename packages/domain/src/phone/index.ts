/** An Israeli mobile number as `052-340-1187`; any other number as it is. Shown left to right inside Hebrew text. */
export function formatPhone(e164: string): string {
  const match = /^\+972(5\d)(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]}-${match[2]}-${match[3]}` : e164;
}

/** The `tel:` link for an E.164 number (`+972523401187`), or `null` when the number cannot be dialed from it. */
export function telHref(e164: string): string | null {
  return /^\+[1-9]\d{6,14}$/.test(e164) ? `tel:${e164}` : null;
}
