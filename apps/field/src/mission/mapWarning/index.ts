/**
 * The warning on the map when nothing more urgent shows: a "הנעדר אותר" report that waits on the phone comes first
 * (the commander has not heard the person was found, UC-F09), then a lost GPS (decision 42).
 */
export function mapWarning({
  gpsLost,
  locatedWaiting,
}: {
  gpsLost: boolean;
  locatedWaiting: boolean;
}): { text: string; action: null } | null {
  if (locatedWaiting) {
    return { text: 'דיווח "הנעדר אותר" עדיין לא הגיע למנהל. הוא יישלח אוטומטית כשהחיבור יחזור.', action: null };
  }
  if (gpsLost) {
    return { text: 'ה-GPS לא זמין: המסלול לא נרשם. הפעל את שירותי המיקום בטלפון.', action: null };
  }
  return null;
}
