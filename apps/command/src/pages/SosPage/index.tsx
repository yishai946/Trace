import type { Participant, Sos } from '@trace/schemas';
import { ListState } from '../../components/ListState';
import { SosCard } from './SosCard';
import { SosHistory } from './SosHistory';
import styles from './SosPage.module.css';

export interface SosPageProps {
  /** Newest first, as the API returns them. `undefined` while loading. */
  sos: Sos[] | undefined;
  loadFailed: boolean;
  onRetry: () => void;
  /** For the sender's phone number. */
  participants: Participant[];
  /** Undefined while closing is blocked: no connection. */
  onClose?: (sosId: string) => void;
  /** The SOS being closed, if any. */
  closingId: string | null;
  error: string | null;
  /** The phone layout (Cm12): one column, without the panel frame. */
  phone?: boolean;
}

/** The mission's SOS (UC-C14, wireframes Cd12 and Cm12): the active ones first, then the closed ones as history. */
export function SosPage({ sos, loadFailed, onRetry, participants, onClose, closingId, error, phone }: SosPageProps) {
  const active = sos?.filter((s) => s.status === 'active') ?? [];
  const closed = sos?.filter((s) => s.status === 'closed') ?? [];
  const phoneOf = (s: Sos) => participants.find((p) => p.id === s.sender.participantId)?.phone;

  return (
    <section className={styles.page} data-phone={phone || undefined} aria-label="SOS">
      <header className={styles.head}>
        <h1 className={styles.title}>SOS</h1>
        {sos && (
          <span className={styles.meta}>
            {active.length} פעילות, {closed.length} סגורות
          </span>
        )}
      </header>
      <div className={styles.body}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <ListState
          items={sos}
          loadFailed={loadFailed}
          onRetry={onRetry}
          className={styles.empty}
          text={{
            failed: 'לא ניתן לטעון את קריאות ה-SOS מהשרת.',
            loading: 'טוען קריאות SOS…',
            empty: 'אין קריאות SOS במסע',
          }}
        >
          {() => (
            <>
              {active.map((s) => (
                <SosCard key={s.id} sos={s} phone={phoneOf(s)} onClose={onClose} closing={closingId === s.id} />
              ))}
              {active.length === 0 && <p className={styles.quiet}>אין קריאות SOS פעילות.</p>}
              {closed.length > 0 && <SosHistory closed={closed} />}
            </>
          )}
        </ListState>
      </div>
    </section>
  );
}
