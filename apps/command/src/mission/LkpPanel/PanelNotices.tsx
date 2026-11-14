import styles from './LkpPanel.module.css';

interface PanelNoticesProps {
  /** The mission ended: LKP and sightings are read-only. */
  ended: boolean;
  /** The mission accepts LKP changes and the console is online. */
  canChange: boolean;
  error: string | null;
}

/** Why nothing can be changed, or what went wrong with the last change. */
export function PanelNotices({ ended, canChange, error }: PanelNoticesProps) {
  return (
    <>
      {ended && <p className={styles.hint}>המסע הסתיים. LKP ותצפיות לקריאה בלבד.</p>}
      {!ended && !canChange && <p className={styles.hint}>אין חיבור. פעולות חדשות חסומות.</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
