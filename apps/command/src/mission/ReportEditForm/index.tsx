import { REPORT_TEXT_MAX } from '@trace/schemas';
import { REPORT_TYPE_LABELS, REPORT_TYPES } from '@trace/domain';
import type { Report, ReportType, UpdateReportBody } from '@trace/schemas';
import { useEffect, useRef, useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import styles from './ReportEditForm.module.css';

export interface ReportEditFormProps {
  report: Report;
  /** Receives only the fields that changed; never called when nothing did. */
  onSave: (body: UpdateReportBody) => void;
  onCancel: () => void;
  busy: boolean;
}

/** Edits a report's category and text (decision 88). The position and the photo stay as the phone sent them. */
export function ReportEditForm({ report, onSave, onCancel, busy }: ReportEditFormProps) {
  const [type, setType] = useState<ReportType>(report.type);
  const [text, setText] = useState(report.text);
  const [blank, setBlank] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // Opening the form puts the cursor in the description.
  useEffect(() => form.current?.querySelector('textarea')?.focus(), []);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setBlank(true);
      return;
    }
    const body: UpdateReportBody = {
      ...(type !== report.type && { type }),
      ...(trimmed !== report.text && { text: trimmed }),
    };
    if (Object.keys(body).length === 0) onCancel();
    else onSave(body);
  };

  return (
    <form
      ref={form}
      className={styles.editForm}
      aria-label="עריכת דיווח"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <RadioGroup className={styles.editField} aria-label="סוג" value={type} onChange={(v) => setType(v as ReportType)}>
        <Label className={styles.label}>סוג</Label>
        <div className={styles.chips}>
          {REPORT_TYPES.map((t) => (
            <Radio key={t} value={t} className={styles.chip}>
              {REPORT_TYPE_LABELS[t]}
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <TextField
        label="תיאור"
        rows={4}
        maxLength={REPORT_TEXT_MAX}
        isRequired
        value={text}
        onChange={(value) => {
          setText(value);
          setBlank(false);
        }}
        isInvalid={blank}
        errorMessage="כתבו תיאור."
      />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" isDisabled={busy}>
          שמור
        </Button>
        <Button onPress={onCancel} isDisabled={busy}>
          בטל
        </Button>
      </div>
    </form>
  );
}
