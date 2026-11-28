import type {
  AssignmentRecord,
  Mission,
  MissionPolygon,
  Participant,
  Report,
  Sos,
  TimelineEvent,
} from '@trace/schemas';
import { Button } from '../../components/Button';
import { EventText } from '../EventText';
import { coverageRows, stillInField } from '../endedSummaryData';
import { describeEvent, formatEventTime, spansDays } from '../timelineEvent';
import { AssignmentHistory } from './AssignmentHistory';
import { Counts } from './Counts';
import { Outcome } from './Facts';
import styles from './EndedSummary.module.css';

interface EndedSummaryProps {
  mission: Mission;
  /** Undefined while a list loads or when it failed: the panel then says so instead of showing zero. */
  polygons: MissionPolygon[] | undefined;
  participants: Participant[] | undefined;
  reports: Report[] | undefined;
  sos: Sos[] | undefined;
  /** The Timeline, oldest first. Undefined while it loads or when it failed. */
  events: TimelineEvent[] | undefined;
  /** The assignment history, oldest first. Undefined while it loads or when it failed. */
  assignments?: AssignmentRecord[];
  onOpenSearcher?: (participantId: string) => void;
  onOpenTimeline: () => void;
}

/** Events that say what happened; the periodic warnings are left to the full Timeline. */
const NOISE = new Set(['contact.lost', 'contact.restored', 'battery.low', 'search.started']);
const KEY_EVENTS = 4;
const UNAVAILABLE = 'הנתונים אינם זמינים כרגע.';

/** The Cd15 panel: the read-only summary of an ended mission: result, final numbers, final coverage, key events. */
export function EndedSummary({
  mission,
  polygons,
  participants,
  reports,
  sos,
  events,
  assignments,
  onOpenSearcher,
  onOpenTimeline,
}: EndedSummaryProps) {
  const rows = polygons && coverageRows(polygons);
  const senderOf = (sosId: string) => sos?.find((s) => s.id === sosId)?.sender;
  const key = [...(events ?? [])]
    .filter((e) => !NOISE.has(e.type))
    .reverse()
    .slice(0, KEY_EVENTS);
  const withDate = events ? spansDays(events) : false;
  const inField = participants ? stillInField(participants) : 0;

  return (
    <aside className={styles.panel} aria-label="סיכום מסע">
      <div className={styles.head}>
        <h2 className={styles.title}>סיכום מסע</h2>
        <div className={styles.sub}>נתונים סופיים, לא ניתנים לעריכה</div>
      </div>
      <div className={styles.body}>
        <Outcome mission={mission} />
        <Counts
          searchers={participants?.length}
          polygons={polygons?.length}
          reports={reports?.length}
          sos={sos}
          assignments={assignments?.length}
        />
        <section className={styles.section} aria-label="כיסוי סופי">
          <p className={styles.label}>כיסוי סופי</p>
          {!rows ? (
            <p className={styles.note}>{UNAVAILABLE}</p>
          ) : rows.length === 0 ? (
            <p className={styles.note}>לא הוגדרו פוליגונים במסע.</p>
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => (
                <li key={row.id} className={styles.row}>
                  <span>{row.name}</span>
                  <span className={styles.value}>{row.label}</span>
                  {row.percent !== null && (
                    <span
                      className={styles.bar}
                      role="progressbar"
                      aria-label={`כיסוי ${row.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={row.percent}
                    >
                      <span className={styles.fill} style={{ inlineSize: `${row.percent}%` }} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {onOpenSearcher && <AssignmentHistory assignments={assignments} onOpenSearcher={onOpenSearcher} />}
        <section className={styles.section} aria-label="אירועי מפתח">
          <p className={styles.label}>אירועי מפתח</p>
          {!events ? (
            <p className={styles.note}>{UNAVAILABLE}</p>
          ) : key.length === 0 ? (
            <p className={styles.note}>אין אירועים להצגה.</p>
          ) : (
            <ul className={styles.list}>
              {key.map((event) => (
                <li key={event.id} className={styles.event}>
                  <span className={styles.time}>{formatEventTime(event.occurredAt, withDate)}</span>
                  <span>
                    <EventText segments={describeEvent(event, senderOf).segments} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" className={styles.more} onPress={onOpenTimeline}>
            ציר זמן מלא
          </Button>
        </section>
        {inField > 0 && (
          <section className={styles.section}>
            <p className={styles.safety}>מעקב בטיחותי ממשיך בשטח עד שכל מחפש מסיים פעילות, {inField} עדיין בשטח</p>
          </section>
        )}
      </div>
    </aside>
  );
}
