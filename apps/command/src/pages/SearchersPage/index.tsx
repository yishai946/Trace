import { formatPhone } from '@trace/domain';
import type { MissionPolygon, Participant } from '@trace/schemas';
import styles from './SearchersPage.module.css';
import { CallButton } from '../../components/CallButton';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import { statusLabel } from '../../mission/participantStatus';
import { AssignMenu } from './AssignMenu';
import { EndParticipation } from './EndParticipation';
import { ListState } from '../../components/ListState';

export interface SearchersPageProps {
  /** `undefined` while loading. */
  participants: Participant[] | undefined;
  polygons: MissionPolygon[];
  loadFailed: boolean;
  onRetry: () => void;
  /** Assigns or moves a searcher (UC-C09). Without it, offline or once the mission ended, the menu is disabled. */
  onAssign?: (participantId: string, polygonId: string) => void;
  /** Ends a searcher's participation (UC-C18), after the commander confirms. Without it the action is disabled. */
  onEnd?: (participantId: string) => void;
  /** An assignment is being saved: the menus wait, so two quick choices cannot land out of order. */
  assigning?: boolean;
  /** The last assignment failed, in words. */
  assignError?: string | null;
}

/** Waiting searchers first, the candidates for assignment (UC-C08 step 3), then assigned, then those in the field. */
const GROUP: Record<string, number> = { available: 0, ready: 1, finished: 1, searching: 2, paused: 2 };
const groupOf = (p: Participant) => (p.status === 'available' ? 0 : (GROUP[p.taskStatus ?? 'ready'] ?? 1));

/**
 * The searcher pool (UC-C08, wireframe Cd08): everyone in the mission, waiting searchers first, with name, phone, state, polygon
 * and when their position last arrived. A searcher who joins appears without a refresh (`participant.joined`).
 */
export function SearchersPage({
  participants,
  polygons,
  loadFailed,
  onRetry,
  onAssign,
  onEnd,
  assigning = false,
  assignError,
}: SearchersPageProps) {
  const inMission = participants
    ?.filter((p) => p.status !== 'ended')
    .sort((a, b) => groupOf(a) - groupOf(b) || a.callsign - b.callsign);
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

      {assignError && (
        <p className={styles.error} role="alert">
          {assignError}
        </p>
      )}

      <div className={styles.body}>
        <ListState
          items={inMission}
          loadFailed={loadFailed}
          onRetry={onRetry}
          className={styles.empty}
          text={{
            failed: 'לא ניתן לטעון מחפשים מהשרת.',
            loading: 'טוען מחפשים…',
            empty: 'עוד לא הצטרפו מחפשים. שתפו את קוד ההצטרפות.',
          }}
        >
          {(inMission) => (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">מחפש</th>
                  <th scope="col">טלפון</th>
                  <th scope="col">סטטוס</th>
                  <th scope="col">פוליגון</th>
                  <th scope="col">עדכון אחרון</th>
                  <th scope="col">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {inMission.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className={styles.who}>
                        <CallsignChip callsign={p.callsign} state={p.status === 'available' ? 'waiting' : 'normal'} />
                        <span>{p.name}</span>
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
                    <td>{p.status === 'assigned' ? polygonName(p.polygonId) : '—'}</td>
                    <td>
                      {p.gpsUnavailableSince ? (
                        <span className={styles.warning}>
                          GPS לא זמין מ-
                          <time dateTime={p.gpsUnavailableSince} className={styles.num}>
                            {timeLabel(p.gpsUnavailableSince)}
                          </time>{' '}
                        </span>
                      ) : null}
                      {p.positionAt ? (
                        <time dateTime={p.positionAt} className={styles.num}>
                          {timeLabel(p.positionAt)}
                        </time>
                      ) : (
                        <span className={styles.meta}>אין עדיין</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.actions}>
                        <CallButton phone={p.phone} name={p.name} display="icon" />
                        <AssignMenu participant={p} polygons={polygons} onAssign={assigning ? undefined : onAssign} />
                        <EndParticipation participant={p} onEnd={assigning ? undefined : onEnd} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ListState>
      </div>
    </section>
  );
}
