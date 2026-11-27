import { useState } from 'react';
import { Button } from '../../components/Button';
import { CallsignChip } from '../../components/CallsignChip';
import type { SafetyWarning } from '../safetyWarnings';
import { timeLabel } from '../timeLabel';
import styles from './SafetyAlert.module.css';

export interface SafetyAlertProps {
  /** Most urgent first. */
  warnings: SafetyWarning[];
  onOpen: (participantId: string) => void;
  /** The phone: one line under the top bar. */
  compact?: boolean;
}

/**
 * The warning banner (UC-S04, wireframe Cd09 banner): one at a time, the most urgent first, with the count of all.
 * A searcher's warning stays while the condition lasts; a polygon's Coverage warning is closed by the commander. A
 * step below SOS and the critical report: marked by the word and the warning line, never by color alone.
 */
export function SafetyAlert({ warnings, onOpen, compact }: SafetyAlertProps) {
  // shortcut: closing is remembered only while the banner is mounted; store it if commanders find it coming back.
  const [closed, setClosed] = useState<string[]>([]);
  const shown = warnings.filter((w) => !closed.includes(w.key));
  const warning = shown[0];
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
      {participantId ? (
        <Button onPress={() => onOpen(participantId)}>פתח</Button>
      ) : (
        <Button onPress={() => setClosed((keys) => [...keys, warning.key])}>סגור</Button>
      )}
    </section>
  );
}
