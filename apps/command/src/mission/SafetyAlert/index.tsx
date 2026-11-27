import { useState } from 'react';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import type { SafetyWarning } from '../safetyWarnings';
import { timeLabel } from '../timeLabel';
import styles from './SafetyAlert.module.css';
import { closeWarning, useOpenWarnings } from './useOpenWarnings';

export interface SafetyAlertProps {
  /** Most urgent first. */
  warnings: SafetyWarning[];
  onOpen: (participantId: string) => void;
  /** The phone: one line under the top bar. */
  compact?: boolean;
}

/**
 * The warning banner (UC-S04, wireframe Cd09 banner): one at a time, the most urgent first, with the count of all.
 * A searcher's warning stays while the condition lasts, and "הבא" moves to the next one; a polygon's Coverage warning is
 * closed by the commander. A
 * step below SOS and the critical report: marked by the word and the warning line, never by color alone.
 */
export function SafetyAlert({ warnings, onOpen, compact }: SafetyAlertProps) {
  const [index, setIndex] = useState(0);
  const shown = useOpenWarnings(warnings);
  const warning = shown[index % shown.length];
  if (!warning) return null;
  const { participantId, callsign, since } = warning;
  return (
    <section
      className={styles.alert}
      data-compact={compact || undefined}
      role="alert"
      aria-label={`אזהרה: ${warning.title}`}
    >
      <span className={styles.badge}>{shown.length > 1 ? `אזהרה · ${shown.length}` : 'אזהרה'}</span>
      <div className={styles.text}>
        {callsign !== null && <CallsignChip callsign={callsign} />} <b>{warning.name}</b> {warning.message}
        {since && (
          <>
            , מאז{' '}
            <time className={styles.num} dateTime={since}>
              {timeLabel(since)}
            </time>
          </>
        )}
      </div>
      {shown.length > 1 && <Button onPress={() => setIndex((i) => (i + 1) % shown.length)}>הבא</Button>}
      {participantId ? (
        <Button onPress={() => onOpen(participantId)}>פתח</Button>
      ) : (
        <Button onPress={() => closeWarning(warning.key)}>סגור</Button>
      )}
    </section>
  );
}
