import type { Participant } from '@trace/schemas';
import { Button } from '../../components/Button';
import { CallButton } from '../../components/CallButton';
import { CallsignChip } from '../../components/CallsignChip';
import { formatCoordinate } from '../../pages/NewMissionPage/newMissionForm';
import { statusLabel } from '../participantStatus';
import { timeLabel } from '../timeLabel';
import styles from './SearcherPanel.module.css';

interface SearcherPanelProps {
  searcher: Participant;
  /** The polygon the searcher is assigned to, or null. */
  polygonName: string | null;
  /** The route's length in meters; null while the route loads. */
  routeMeters: number | null;
  routeFailed: boolean;
  /** The mission ended: the position and battery are the last known. */
  historical?: boolean;
  onRetryRoute: () => void;
  onClose: () => void;
}

/** In an ended mission the position and battery are the last known, not current. */
const panelLabels = (historical?: boolean) =>
  historical
    ? { position: 'מיקום אחרון ידוע', battery: 'סוללה (אחרונה)' }
    : { position: 'מיקום נוכחי', battery: 'סוללה' };

const NONE = 'אין עדיין';

/** `3.8 ק״מ` from a kilometer up, else whole meters. */
const lengthLabel = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} ק״מ` : `${Math.round(meters)} מ׳`;

/**
 * One searcher's details over the map (UC-C10, wireframe Cd09): position, polygon, status, route, last update,
 * connectivity and battery (decision 13).
 */
export function SearcherPanel({
  searcher,
  polygonName,
  routeMeters,
  routeFailed,
  historical,
  onRetryRoute,
  onClose,
}: SearcherPanelProps) {
  const labels = panelLabels(historical);
  const [lng, lat] = searcher.position ?? [];
  const updatedAt = searcher.lastUpdateAt ?? searcher.positionAt;

  return (
    <section className={styles.panel} aria-label="פרטי מחפש">
      <div className={styles.head}>
        <CallsignChip callsign={searcher.callsign} state={searcher.offline ? 'offline' : 'normal'} />
        <div className={styles.titles}>
          <h2 className={styles.name}>{searcher.name}</h2>
          <div className={styles.sub}>{statusLabel(searcher)}</div>
        </div>
        <Button variant="icon" aria-label="סגור" onPress={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Button>
      </div>
      {searcher.gpsUnavailableSince && (
        <p className={styles.warning} role="status">
          GPS לא זמין מאז <time dateTime={searcher.gpsUnavailableSince}>{timeLabel(searcher.gpsUnavailableSince)}</time>
        </p>
      )}
      <dl className={styles.facts}>
        <div className={styles.wide}>
          <dt>{labels.position}</dt>
          <dd dir="ltr" className={styles.start}>
            {lat === undefined || lng === undefined ? NONE : `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`}
          </dd>
        </div>
        <div>
          <dt>פוליגון</dt>
          <dd>{polygonName ?? '—'}</dd>
        </div>
        <div>
          <dt>סטטוס</dt>
          <dd>{statusLabel(searcher)}</dd>
        </div>
        <div>
          <dt>מסלול</dt>
          <dd>
            {routeFailed ? (
              <>
                <span className={styles.warn}>לא נטען</span>{' '}
                <Button variant="secondary" onPress={onRetryRoute}>
                  נסה שוב
                </Button>
              </>
            ) : routeMeters === null ? (
              'טוען…'
            ) : routeMeters === 0 ? (
              NONE
            ) : (
              lengthLabel(routeMeters)
            )}
          </dd>
        </div>
        <div>
          <dt>עדכון אחרון</dt>
          <dd>{updatedAt ? <time dateTime={updatedAt}>{timeLabel(updatedAt)}</time> : NONE}</dd>
        </div>
        <div>
          <dt>קישוריות</dt>
          <dd className={searcher.offline ? styles.warn : styles.ok}>{searcher.offline ? 'לא מקוון' : 'מקוון'}</dd>
        </div>
        <div>
          <dt>{labels.battery}</dt>
          <dd>{searcher.battery ? `${searcher.battery.level}%` : 'לא דווחה'}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <CallButton phone={searcher.phone} name={searcher.name} />
      </div>
    </section>
  );
}
