import type { LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import { Button } from '../../components/Button';
import type { Place } from '../../map/geocoding';
import { PlacePicker, type PlaceMode } from '../../map/PlacePicker';
import { formatCoordinate } from '../../pages/NewMissionPage/newMissionForm';
import styles from './RallyPointPanel.module.css';

interface RallyPointPanelProps {
  provider: MapProvider;
  /** The mission's current rally point. */
  point: LngLat;
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  /** The commander chose a new point. Ignored while a change is being saved. */
  onChange: (point: LngLat) => void;
  onPlaceFound: (place: Place) => void;
  /** A change is being saved. */
  busy: boolean;
  /** Why the last change failed. */
  error: string | null;
  /** The last change was saved. */
  saved: boolean;
  /** Why no change is possible now: the mission ended, or the server cannot be reached. */
  blocked: 'ended' | 'offline' | null;
  onClose: () => void;
}

const BLOCKED_NOTICES = {
  ended: 'אי אפשר לשנות נקודת כינוס במסע שהסתיים.',
  offline: 'אין חיבור לשרת. אפשר לשנות כשהחיבור יחזור.',
};

/** The mission's rally point, and the ways to change it: map click, place search or coordinates (UC-C05, wireframe Cd06). */
export function RallyPointPanel({
  provider,
  point,
  mode,
  onModeChange,
  onChange,
  onPlaceFound,
  busy,
  error,
  saved,
  blocked,
  onClose,
}: RallyPointPanelProps) {
  return (
    <section className={styles.panel} aria-label="נקודת כינוס">
      <div className={styles.head}>
        <h2 className={styles.title}>נקודת כינוס</h2>
        <span className={styles.badge}>
          <span className={styles.dot} aria-hidden="true" />
          פעילה
        </span>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.body}>
        <p className={styles.coords} dir="ltr">
          {formatCoordinate(point[1])}, {formatCoordinate(point[0])}
        </p>
        <h3 className={styles.label}>שינוי כינוס</h3>
        {blocked ? (
          <p className={styles.notice}>{BLOCKED_NOTICES[blocked]}</p>
        ) : (
          <>
            <PlacePicker
              provider={provider}
              pointName="נקודת כינוס"
              point={point}
              mode={mode}
              onModeChange={onModeChange}
              onChange={(next) => {
                if (!busy) onChange(next);
              }}
              onPlaceFound={onPlaceFound}
            />
            <p className={styles.hint}>מתעדכן מיד ב-Field. מחפש לא מקוון יקבל בחיבור הבא.</p>
          </>
        )}
        {busy && <p className={styles.hint}>מעדכן…</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className={styles.saved} role="status">
            נקודת הכינוס עודכנה.
          </p>
        )}
      </div>
    </section>
  );
}
