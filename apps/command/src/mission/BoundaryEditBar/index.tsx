import { formatCallsign } from '@trace/domain';
import { Button } from '../../components/Button';
import styles from './BoundaryEditBar.module.css';

export interface OutsideSearcher {
  callsign: number;
  name: string;
  meters: number;
}

interface BoundaryEditBarProps {
  letter: string;
  /** Assigned searchers the new boundary leaves outside (UC-C06). */
  outside: OutsideSearcher[];
  /** The edited boundary crosses itself and cannot be saved. */
  invalid: boolean;
  busy: boolean;
  /** No connection: saving is blocked until it returns (UC-C01); cancelling still works. */
  offline?: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}

function outsideText(outside: OutsideSearcher[]): string {
  const names = outside.map((s) => `${formatCallsign(s.callsign)} ${s.name}`).join(', ');
  return outside.length === 1
    ? `${names} יהיה מחוץ לגבול החדש. אחרי השמירה תישלח הודעה למחפשים בפוליגון.`
    : `${names} יהיו מחוץ לגבול החדש. אחרי השמירה תישלח הודעה למחפשים בפוליגון.`;
}

/** The bar shown while a polygon boundary is reshaped (Cd07): what the change affects, then cancel or save. */
export function BoundaryEditBar({
  letter,
  outside,
  invalid,
  busy,
  offline = false,
  error,
  onCancel,
  onSave,
}: BoundaryEditBarProps) {
  const warning = outside.length > 0;
  const detail =
    error ??
    (offline
      ? 'אין חיבור לאינטרנט. אפשר לשמור את הגבול כשהחיבור יחזור.'
      : invalid
        ? 'הגבול חותך את עצמו. הזיזו נקודה כדי לתקן.'
        : warning
          ? outsideText(outside)
          : null);

  return (
    <div className={styles.bar} role="status">
      {(warning || invalid || offline || error) && (
        <svg
          className={styles.icon}
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M12 3 2 20h20zM12 10v4M12 17h.01" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
      <div className={styles.text}>
        <div>עריכת גבול פוליגון {letter}</div>
        <div className={styles.meta}>{detail ?? 'גררו נקודה להזזה, או נקודת ביניים להוספת נקודה.'}</div>
      </div>
      <Button onPress={onCancel} isDisabled={busy}>
        בטל
      </Button>
      <Button variant="primary" onPress={onSave} isDisabled={busy || invalid || offline}>
        שמור גבול
      </Button>
    </div>
  );
}
