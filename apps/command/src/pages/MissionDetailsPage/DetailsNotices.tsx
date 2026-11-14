import styles from './MissionDetailsPage.module.css';
import { PHOTO_SAVE_FAILED, saveErrorMessage } from './missionDetailsForm';

interface DetailsNoticesProps {
  readOnly: boolean;
  online: boolean;
  saveError: Error | null;
  photoFailed: boolean;
  saved: boolean;
}

/** What the footer says about the details: read-only, offline, a failed save or photo, or that it saved. */
export function DetailsNotices({ readOnly, online, saveError, photoFailed, saved }: DetailsNoticesProps) {
  const notices = [
    readOnly && (
      <p key="ended" className={styles.meta}>
        המסע הסתיים. הפרטים לקריאה בלבד.
      </p>
    ),
    !readOnly && !online && (
      <p key="offline" className={styles.meta}>
        אין חיבור לשרת. אפשר לשמור כשהחיבור יחזור.
      </p>
    ),
    saveError && (
      <p key="error" className={styles.error} role="alert">
        {saveErrorMessage(saveError)}
      </p>
    ),
    photoFailed && (
      <p key="photo" className={styles.error} role="alert">
        {PHOTO_SAVE_FAILED}
      </p>
    ),
    saved && (
      <p key="saved" className={styles.meta} role="status">
        השינויים נשמרו.
      </p>
    ),
  ].filter(Boolean);
  return notices.length > 0 ? <div className={styles.footer}>{notices}</div> : null;
}
