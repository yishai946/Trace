import type { LkpPoint, Mission } from '@trace/schemas';
import { timeLabel } from '../timeLabel';
import styles from './LkpPanel.module.css';
import { coordinates } from './lkpText';

interface CurrentLkpProps {
  mission: Mission;
  /** The mission's LKP history, newest first. */
  lkps: LkpPoint[] | undefined;
}

/** The current LKP and the ones before it. Until the history loads, the mission's own LKP shows. */
export function CurrentLkp({ mission, lkps }: CurrentLkpProps) {
  const current = lkps?.find((p) => p.current);
  const history = lkps?.filter((p) => !p.current) ?? [];
  return (
    <div className={styles.section}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>LKP נוכחי</h2>
        <span className={styles.badge} data-tone="neutral">
          פעיל
        </span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>שעה</dt>
          <dd className={styles.num}>{timeLabel(current?.observedAt ?? mission.lkp?.observedAt ?? '')}</dd>
        </div>
        <div>
          <dt>הוגדר על ידי</dt>
          <dd>{current?.setBy ?? '—'}</dd>
        </div>
        <div className={styles.wide}>
          <dt>קואורדינטות</dt>
          <dd className={styles.num} dir="ltr">
            {coordinates((current ?? mission.lkp)?.position ?? mission.rallyPoint)}
          </dd>
        </div>
      </dl>

      <h3 className={styles.label}>היסטוריה</h3>
      {history.length === 0 ? (
        <p className={styles.hint}>אין LKP קודמים.</p>
      ) : (
        <ul className={styles.history} aria-label="היסטוריה">
          {history.map((point) => (
            <li key={point.id}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="8" cy="8" r="5" />
              </svg>
              <span className={styles.historyText}>
                LKP קודם,{' '}
                <span className={styles.num} dir="ltr">
                  {coordinates(point.position)}
                </span>
              </span>
              <span className={styles.meta}>{timeLabel(point.observedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
