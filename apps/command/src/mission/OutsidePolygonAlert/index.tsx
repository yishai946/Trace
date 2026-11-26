import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import type { OutsideSearcher } from '../outsideSearchers';
import { timeLabel } from '../timeLabel';
import styles from './OutsidePolygonAlert.module.css';

export interface OutsidePolygonAlertProps {
  /** Who is outside their polygon now, the one outside the longest first. */
  searchers: OutsideSearcher[];
  onOpen: (participantId: string) => void;
}

/**
 * The warning that a searcher left their polygon (UC-S04, decision 14, wireframe Cd09 banner): shown while they stay
 * outside and gone once they are back. A warning, a step below SOS and the critical report: marked by the word and the
 * warning line, never by color alone. Several searchers are counted like the SOS banner.
 */
export function OutsidePolygonAlert({ searchers, onOpen }: OutsidePolygonAlertProps) {
  const searcher = searchers[0];
  if (!searcher) return null;
  return (
    <section className={styles.alert} role="alert" aria-label="אזהרה: מחפש מחוץ לפוליגון">
      <span className={styles.badge}>{searchers.length > 1 ? `אזהרה · ${searchers.length}` : 'אזהרה'}</span>
      <div className={styles.text}>
        <CallsignChip callsign={searcher.callsign} /> <b>{searcher.name}</b> מחוץ ל{searcher.polygonName},{' '}
        {searcher.meters} מ׳ מהגבול, מאז{' '}
        <time className={styles.num} dateTime={searcher.since}>
          {timeLabel(searcher.since)}
        </time>
      </div>
      <Button onPress={() => onOpen(searcher.participantId)}>פתח</Button>
    </section>
  );
}
