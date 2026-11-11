import { formatPhone } from '@trace/domain';
import type { MissionPolygon, Participant } from '@trace/schemas';
import styles from './SearchersPage.module.css';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';

export interface SearchersPageProps {
  /** `undefined` while loading. */
  participants: Participant[] | undefined;
  polygons: MissionPolygon[];
  loadFailed: boolean;
  onRetry: () => void;
}

/** The searcher's state in words, as in wireframe Cd08. */
export function statusLabel(p: Pick<Participant, 'status' | 'taskStatus'>): string {
  if (p.status === 'available') return 'זמין';
  if (p.status === 'ended') return 'סיים';
  if (p.taskStatus === 'searching') return 'בחיפוש';
  if (p.taskStatus === 'paused') return 'מושהה';
  return 'משובץ';
}

/**
 * The searcher pool (UC-C08, wireframe Cd08): everyone in the mission by callsign, with name, phone, state, polygon
 * and when their position last arrived. A searcher who joins appears without a refresh (`participant.joined`).
 */
export function SearchersPage({ participants, polygons, loadFailed, onRetry }: SearchersPageProps) {
  const inMission = participants?.filter((p) => p.status !== 'ended').sort((a, b) => a.callsign - b.callsign);
  const waiting = inMission?.filter((p) => p.status === 'available').length ?? 0;
  const polygonName = (id: string | null) => polygons.find((p) => p.id === id)?.name ?? '—';

  return (
    <section className={styles.panel} aria-label="מאגר מחפשים">
      <div className={styles.section}>
        <h1 className={styles.title}>מאגר מחפשים</h1>
        {inMission && (
          <span className={styles.meta}>
            {inMission.length} במסע, {waiting} ממתינים לשיבוץ
          </span>
        )}
      </div>

      <div className={styles.body}>
        {inMission === undefined ? (
          loadFailed ? (
            <div className={styles.empty}>
              <p role="alert">לא ניתן לטעון מחפשים מהשרת.</p>
              <Button onPress={onRetry}>נסה שוב</Button>
            </div>
          ) : (
            <p className={styles.empty}>טוען מחפשים…</p>
          )
        ) : inMission.length === 0 ? (
          <p className={styles.empty}>עוד לא הצטרפו מחפשים. שתפו את קוד ההצטרפות.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">מחפש</th>
                <th scope="col">טלפון</th>
                <th scope="col">סטטוס</th>
                <th scope="col">פוליגון</th>
                <th scope="col">עדכון אחרון</th>
              </tr>
            </thead>
            <tbody>
              {inMission.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className={styles.who}>
                      <CallsignChip callsign={p.callsign} state={p.status === 'available' ? 'waiting' : 'normal'} />
                      <span className={styles.name}>{p.name}</span>
                    </span>
                  </td>
                  <td>
                    <a className={styles.num} href={`tel:${p.phone}`}>
                      {formatPhone(p.phone)}
                    </a>
                  </td>
                  <td>
                    <span className={styles.badge}>{statusLabel(p)}</span>
                  </td>
                  <td className={styles.name}>{p.status === 'assigned' ? polygonName(p.polygonId) : '—'}</td>
                  <td>
                    {p.positionAt ? (
                      <time dateTime={p.positionAt} className={styles.num}>
                        {timeLabel(p.positionAt)}
                      </time>
                    ) : (
                      <span className={styles.meta}>אין עדיין</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
