/** Said wherever information saved on the phone shows because the server cannot be reached (UC-F04). */
export const NOT_UP_TO_DATE = 'מוצג מידע שנשמר במכשיר. ייתכן שהוא לא מעודכן.';

/**
 * The warning on the map when nothing more urgent shows: leaving the polygon comes first, a safety matter that stays
 * while it lasts and clears on return (UC-S04); then the end of the mission as located (UC-C16), which the
 * searcher must not miss; then a "הנעדר אותר" report that waits on the phone comes first
 * (the commander has not heard the person was found, UC-F09), then a lost GPS (decision 42), then saved mission
 * information shown without a connection (UC-F04).
 */
export function mapWarning({
  gpsLost,
  locatedWaiting,
  notUpToDate = false,
  outsidePolygon = false,
  missionLocated = false,
}: {
  gpsLost: boolean;
  locatedWaiting: boolean;
  notUpToDate?: boolean;
  outsidePolygon?: boolean;
  /** The commander ended the mission: the missing person was located (UC-C16). */
  missionLocated?: boolean;
}): { text: string; action: null } | null {
  if (outsidePolygon) {
    return { text: 'יצאתם מגבול הפוליגון שלכם. חזרו לתוך האזור או פנו למנהל.', action: null };
  }
  if (missionLocated) {
    return {
      text: 'הנעדר אותר והמסע הסתיים. הפסיקו את החיפוש וחזרו מהשטח. כשתסיימו, לחצו "סיימתי פעילות".',
      action: null,
    };
  }
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
