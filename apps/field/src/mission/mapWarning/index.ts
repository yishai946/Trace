/** Said wherever information saved on the phone shows because the server cannot be reached (UC-F04). */
export const NOT_UP_TO_DATE = 'מוצג מידע שנשמר במכשיר. ייתכן שהוא לא מעודכן.';

/**
 * The warning on the map when nothing more urgent shows: a "הנעדר אותר" report that waits on the phone comes first
 * (the commander has not heard the person was found, UC-F09), then a lost GPS (decision 42), then saved mission
 * information shown without a connection (UC-F04).
 */
export function mapWarning({
  gpsLost,
  locatedWaiting,
  notUpToDate = false,
}: {
  gpsLost: boolean;
  locatedWaiting: boolean;
  notUpToDate?: boolean;
}): { text: string; action: null } | null {
  if (locatedWaiting) {
    return { text: 'דיווח "הנעדר אותר" עדיין לא הגיע למנהל. הוא יישלח אוטומטית כשהחיבור יחזור.', action: null };
  }
  if (gpsLost) {
    return { text: 'ה-GPS לא זמין: המסלול לא נרשם. הפעל את שירותי המיקום בטלפון.', action: null };
  }
  if (notUpToDate) {
    return { text: NOT_UP_TO_DATE, action: null };
  }
  return null;
}
