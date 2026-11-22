import type { SosSendFailure } from '.';

/** Why the SOS did not reach anyone, per failure (shown on Fm12 under "ה-SOS לא נמסר"). */
export const SEND_REASON: Record<SosSendFailure, string> = {
  offline: 'אין חיבור לשרת, ולכן המנהל והמחפשים לא קיבלו אותו.',
  ended: 'הפעילות שלך הסתיימה, ולכן אי אפשר לשלוח SOS מהטלפון הזה.',
  forbidden: 'אין לך הרשאה לשלוח SOS מהמשתמש הזה, ולכן המנהל והמחפשים לא קיבלו אותו.',
  refused: 'השרת לא קיבל אותו, ולכן המנהל והמחפשים לא קיבלו אותו.',
};

/** Whether trying again (sending or closing) can help: it cannot once the activity ended or the user is not allowed. */
export const canRetry = (failure: SosSendFailure) => failure === 'offline' || failure === 'refused';

/** Why closing the SOS failed; the SOS stays active in every case. */
export const CLOSE_REASON: Record<SosSendFailure, string> = {
  offline: 'הסגירה לא הצליחה. בדוק את החיבור ונסה שוב. ה-SOS עדיין פעיל.',
  ended: 'הפעילות שלך הסתיימה, ולכן אי אפשר לסגור את ה-SOS מהטלפון הזה. ה-SOS עדיין פעיל; פנה למנהל.',
  forbidden: 'אין לך הרשאה לסגור את ה-SOS הזה. ה-SOS עדיין פעיל; פנה למנהל.',
  refused: 'הסגירה לא הצליחה, השרת לא קיבל אותה. נסה שוב. ה-SOS עדיין פעיל.',
};
