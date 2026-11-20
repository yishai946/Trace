import { ROLE_LABELS } from '../../components/ProfileMenu';
import type { Sos } from '@trace/schemas';
import { CallsignChip } from '../../components/CallsignChip';
import { timeLabel } from '../../mission/timeLabel';
import styles from './SosPage.module.css';

/** The closed SOS, newest first: who sent it, what they wrote, and who closed it and when (wireframe Cd12 history). */
export function SosHistory({ closed }: { closed: Sos[] }) {
  return (
    <section className={styles.history} aria-labelledby="sos-history">
      <h2 id="sos-history" className={styles.sectionTitle}>
        היסטוריית SOS <span className={styles.meta}>{closed.length} קריאות סגורות במסע</span>
      </h2>
      <ul className={styles.list}>
        {closed.map((sos) => (
          <li key={sos.id} className={styles.item}>
            <span className={styles.num}>{timeLabel(sos.activatedAt)}</span>
            <span className={styles.who}>
              <CallsignChip callsign={sos.sender.callsign} />
              {sos.sender.name}
            </span>
            <span className={styles.meta}>{sos.polygon?.name ?? 'לא משובץ'}</span>
            <span className={styles.message}>{sos.message ?? 'ללא הודעה'}</span>
            <span className={styles.closed}>
              <span className={styles.badge}>נסגר</span>{' '}
              {sos.closedAt && <span className={styles.num}>{timeLabel(sos.closedAt)}</span>}
              {sos.closedBy && `, ${sos.closedBy.name} (${ROLE_LABELS[sos.closedBy.role]})`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
