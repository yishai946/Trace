import { MESSAGE_URGENCIES, type MessageUrgency } from '@trace/domain';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import styles from './ComposeMessage.module.css';
import { URGENCY_LABEL } from '../messageView';

interface UrgencyChoiceProps {
  value: MessageUrgency;
  onChange: (urgency: MessageUrgency) => void;
}

/** How urgent the message is. A critical one needs every recipient to acknowledge reading it. */
export function UrgencyChoice({ value, onChange }: UrgencyChoiceProps) {
  return (
    <RadioGroup
      className={styles.field}
      orientation="horizontal"
      value={value}
      onChange={(next) => onChange(MESSAGE_URGENCIES.find((urgency) => urgency === next) ?? value)}
    >
      <Label className={styles.label}>דחיפות</Label>
      <div className={styles.seg}>
        {MESSAGE_URGENCIES.map((urgency) => (
          <Radio key={urgency} value={urgency} className={styles.segOption}>
            {URGENCY_LABEL[urgency]}
          </Radio>
        ))}
      </div>
      <p className={styles.hint}>קריטית: כל נמען נדרש לאשר קריאה.</p>
    </RadioGroup>
  );
}
