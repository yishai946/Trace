import type { MissionPolygon, Participant } from '@trace/schemas';
import styles from './SearchersPage.module.css';
import { SearcherRow } from './SearcherRow';
import { ListState } from '../../components/ListState';

export interface SearchersPageProps {
  /** `undefined` while loading. */
  participants: Participant[] | undefined;
  polygons: MissionPolygon[];
  loadFailed: boolean;
  onRetry: () => void;
  /** Opens a searcher's panel over the map (UC-C10, wireframe Cd09). */
  onOpen?: (participantId: string) => void;
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
  onOpen,
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
                  <th scope="col">קישוריות</th>
                  <th scope="col">סוללה</th>
                  <th scope="col">עדכון אחרון</th>
                  <th scope="col">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {inMission.map((p) => (
                  <SearcherRow
                    key={p.id}
                    participant={p}
                    polygonName={polygonName(p.polygonId)}
                    polygons={polygons}
                    onOpen={onOpen}
                    onAssign={assigning ? undefined : onAssign}
                    onEnd={assigning ? undefined : onEnd}
                  />
                ))}
              </tbody>
            </table>
          )}
        </ListState>
      </div>
    </section>
  );
}
