import { formatCallsign } from '@trace/domain';
import styles from './CallsignChip.module.css';

export type CallsignState = 'normal' | 'sos' | 'waiting' | 'offline';

/** Trace Console CallsignChip: the searcher's two-digit number, identical on the map, list, alerts and Inspector. */
export function CallsignChip({ callsign, state = 'normal' }: { callsign: number; state?: CallsignState }) {
  return <span className={[styles.chip, styles[state]].filter(Boolean).join(' ')}>{formatCallsign(callsign)}</span>;
}
