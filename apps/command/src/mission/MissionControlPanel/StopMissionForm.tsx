import { MISSION_STOP_REASONS, STOP_REASON_LABELS } from '@trace/domain';
import type { MissionStopReason, StopMissionBody } from '@trace/schemas';
import { useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { ConfirmEnd } from './ConfirmEnd';
import styles from './MissionControlPanel.module.css';

interface StopMissionFormProps {
  busy: boolean;
  error: string | null;
  offline: boolean;
  onStop: (body: StopMissionBody) => void;
  onEdit: () => void;
}

const isReason = (value: string): value is MissionStopReason => MISSION_STOP_REASONS.some((reason) => reason === value);

/** "הפסק חיפוש": a reason from the list and an optional note; the end is confirmed in a popover first (UC-C17). */
export function StopMissionForm({ busy, error, offline, onStop, onEdit }: StopMissionFormProps) {
  const [reason, setReason] = useState<MissionStopReason | null>(null);
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);

  return (
    <form
      className={styles.form}
      aria-label="הפסק חיפוש"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setMissing(!reason);
      }}
    >
      <RadioGroup
        className={styles.reasons}
        value={reason}
        onChange={(next) => {
          onEdit();
          if (isReason(next)) setReason(next);
        }}
      >
        <Label className={styles.label}>סיבת ההפסקה</Label>
        {MISSION_STOP_REASONS.map((value) => (
          <Radio key={value} value={value} className={styles.reason}>
            {STOP_REASON_LABELS[value]}
          </Radio>
        ))}
      </RadioGroup>
      {missing && !reason && (
        <p className={styles.error} role="alert">
          בחרו את סיבת ההפסקה.
        </p>
      )}
      <TextField
        label="הערה (אופציונלי)"
        rows={3}
        value={note}
        onChange={(value) => {
          onEdit();
          setNote(value);
        }}
      />
      <p className={styles.hint}>
        המסע מסתיים בלי שהנעדר אותר ונשמר לקריאה בלבד. המעקב הבטיחותי נמשך עד סיום הפעילות של כל מחפש.
      </p>
      {offline && <p className={styles.notice}>אין חיבור לשרת. אפשר לסיים את המסע כשהחיבור יחזור.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {reason ? (
        <ConfirmEnd
          label="הפסק חיפוש…"
          question="להפסיק את החיפוש ולסיים את המסע?"
          busy={busy}
          offline={offline}
          onConfirm={() => onStop({ reason, note: note.trim() })}
        />
      ) : (
        <Button variant="primary" type="submit" isDisabled={busy || offline}>
          הפסק חיפוש…
        </Button>
      )}
    </form>
  );
}
