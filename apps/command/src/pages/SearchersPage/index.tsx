import { formatPhone } from '@trace/domain';
import type { MissionPolygon, Participant } from '@trace/schemas';
import { Dialog, DialogTrigger, Heading, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
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
  /** Assigns or moves a searcher (UC-C09). Without it, offline or once the mission ended, the menu is disabled. */
  onAssign?: (participantId: string, polygonId: string) => void;
  /** Ends a searcher's participation (UC-C18), after the commander confirms. Without it the action is disabled. */
  onEnd?: (participantId: string) => void;
  /** An assignment is being saved: the menus wait, so two quick choices cannot land out of order. */
  assigning?: boolean;
  /** The last assignment failed, in words. */
  assignError?: string | null;
}

/** The searcher's state in words, as in wireframe Cd08. */
export function statusLabel(p: Pick<Participant, 'status' | 'taskStatus'>): string {
  if (p.status === 'available') return 'זמין';
  if (p.status === 'ended') return 'סיים';
  if (p.taskStatus === 'searching') return 'בחיפוש';
  if (p.taskStatus === 'paused') return 'מושהה';
  return 'משובץ';
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
                        </time>
                      </span>
                    ) : p.positionAt ? (
                      <time dateTime={p.positionAt} className={styles.num}>
                        {timeLabel(p.positionAt)}
                      </time>
                    ) : (
                      <span className={styles.meta}>אין עדיין</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.actions}>
                      <AssignMenu participant={p} polygons={polygons} onAssign={assigning ? undefined : onAssign} />
                      <EndParticipation participant={p} onEnd={assigning ? undefined : onEnd} />
                    </span>
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

/** "שבץ" for a waiting searcher, "העבר" for an assigned one: a menu of the mission's other polygons (Cd08). */
function AssignMenu({
  participant,
  polygons,
  onAssign,
}: {
  participant: Participant;
  polygons: MissionPolygon[];
  onAssign?: (participantId: string, polygonId: string) => void;
}) {
  const assigned = participant.status === 'assigned';
  const targets = polygons.filter((p) => !assigned || p.id !== participant.polygonId);
  const label = assigned ? 'העבר' : 'שבץ';
  return (
    <MenuTrigger>
      <Button size="sm" aria-label={`${label} את ${participant.name}`} isDisabled={!onAssign || targets.length === 0}>
        {label}
      </Button>
      <Popover className={styles.popover} placement="bottom end">
        <Menu
          className={styles.menu}
          aria-label={`פוליגונים לשיבוץ ${participant.name}`}
          items={targets}
          onAction={(polygonId) => onAssign?.(participant.id, String(polygonId))}
        >
          {(polygon) => (
            <MenuItem id={polygon.id} className={styles.item}>
              {polygon.name}
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** "סיים השתתפות", confirmed in a popover first: the searcher leaves the activity (UC-C18). */
function EndParticipation({
  participant,
  onEnd,
}: {
  participant: Participant;
  onEnd?: (participantId: string) => void;
}) {
  return (
    <DialogTrigger>
      <Button
        size="sm"
        variant="danger-outline"
        isDisabled={!onEnd}
        aria-label={`סיים השתתפות של ${participant.name}…`}
      >
        סיים השתתפות…
      </Button>
      <Popover className={styles.popover} placement="bottom end">
        <Dialog className={styles.confirm} aria-label={`אישור סיום השתתפות של ${participant.name}`}>
          {({ close }) => (
            <>
              <Heading slot="title" className={styles.confirmTitle}>
                לסיים את ההשתתפות של {participant.name}?
              </Heading>
              <p className={styles.meta}>המשימה הפעילה תסתיים והמסלול יישמר. המחפש יוכל להצטרף שוב.</p>
              <span className={styles.actions}>
                <Button size="sm" onPress={close}>
                  ביטול
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onPress={() => {
                    onEnd?.(participant.id);
                    close();
                  }}
                >
                  סיים השתתפות
                </Button>
              </span>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
