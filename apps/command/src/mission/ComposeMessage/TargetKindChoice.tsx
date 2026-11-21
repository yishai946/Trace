import { MESSAGE_TARGET_KINDS, type MessageTargetKind } from '@trace/domain';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { choose } from '../../choose';
import styles from './ComposeMessage.module.css';
import { TARGET_KIND_LABEL } from '../messageView';

interface TargetKindChoiceProps {
  value: MessageTargetKind;
  onChange: (kind: MessageTargetKind) => void;
}

/** Who the message goes to: the whole mission, polygons or one searcher. */
export function TargetKindChoice({ value, onChange }: TargetKindChoiceProps) {
  return (
    <RadioGroup
      className={styles.field}
      orientation="horizontal"
      value={value}
      onChange={(next) => onChange(choose(MESSAGE_TARGET_KINDS, next, 'mission'))}
    >
      <Label className={styles.label}>נמענים</Label>
      <div className={styles.seg}>
        {MESSAGE_TARGET_KINDS.map((kind) => (
          <Radio key={kind} value={kind} className={styles.segOption}>
            {TARGET_KIND_LABEL[kind]}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
