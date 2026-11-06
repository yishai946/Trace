/** Unicode LEFT-TO-RIGHT ISOLATE and POP DIRECTIONAL ISOLATE. */
export const LRI = '⁦';
export const PDI = '⁩';

/**
 * Numbers, phone numbers, coordinates and codes are written left to right inside Hebrew text (brand book). The
 * isolate keeps their characters in order without moving the Hebrew around them.
 */
export function ltr(value: string | number): string {
  return `${LRI}${value}${PDI}`;
}

/**
 * On Android and iOS the app is forced right to left by the expo-localization plugin (`forcesRTL` in app.json).
 * The web build has no such switch, so the root layout marks the document itself.
 */
export function applyDocumentDirection(doc: Document): void {
  doc.documentElement.dir = 'rtl';
  doc.documentElement.lang = 'he';
}
