import { canEndMissionLocated } from '@trace/domain';
import { formatLatLng, type LngLat } from '@trace/geo';
import type { MapProvider } from '@trace/map';
import type { EndMissionLocatedBody, Mission } from '@trace/schemas';
import { Button } from '../../components/Button';
import type { Place } from '../../map/geocoding';
import type { PlaceMode } from '../../map/PlacePicker';
import { timeLabel } from '../timeLabel';
import { EndLocatedForm } from './EndLocatedForm';
import styles from './MissionControlPanel.module.css';

interface MissionControlPanelProps {
  mission: Mission;
  provider: MapProvider;
  /** Where the missing person was found: set by a click on the map, a search or coordinates. */
  point: LngLat | null;
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  onPoint: (point: LngLat) => void;
  onPlaceFound: (place: Place) => void;
  /** The mission is being ended. */
  busy: boolean;
  /** Why the last attempt failed. */
  error: string | null;
  /** No connection: the mission cannot be ended now. */
  offline: boolean;
  /** Called with a valid form once the commander confirmed. */
  onEnd: (body: EndMissionLocatedBody) => void;
  onEdit: () => void;
  onClose: () => void;
}

const STATUS_LABELS = {
  active: 'פעיל',
  paused: 'מושהה',
  ended_located: 'הסתיים: הנעדר אותר',
  ended_stopped: 'הסתיים: הופסק',
} as const;

/** The mission control panel (wireframe Cd13): the mission's state and how it ends. Here: "הנעדר אותר" (UC-C16). */
export function MissionControlPanel({ mission, onClose, ...form }: MissionControlPanelProps) {
  const { located } = mission;
  return (
    <section className={styles.panel} aria-label="בקרת מסע">
      <div className={styles.head}>
        <h2 className={styles.title}>בקרת מסע</h2>
        <span className={styles.badge}>מצב: {STATUS_LABELS[mission.status]}</span>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      <div className={styles.body}>
        {located ? (
          <dl className={styles.facts} aria-label="פרטי האיתור">
            <dt>זמן האיתור</dt>
            <dd>{timeLabel(located.locatedAt)}</dd>
            <dt>מיקום</dt>
            <dd dir="ltr">{formatLatLng(located.position.coordinates)}</dd>
            {located.note && (
              <>
                <dt>הערה</dt>
                <dd>{located.note}</dd>
              </>
            )}
          </dl>
        ) : canEndMissionLocated(mission.status) ? (
          <EndLocatedForm {...form} />
        ) : (
          <p className={styles.hint}>המסע הסתיים ונשמר לקריאה בלבד.</p>
        )}
      </div>
    </section>
  );
}
