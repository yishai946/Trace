import { REPORT_TEXT_MAX, UpdateReportBody, type Report } from '@trace/schemas';
import { useState } from 'react';
import { ApiRequestError } from '../../api';
import { useUpdateReport } from '../../reports/useUpdateReport';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { ReportTypePicker } from '../ReportTypePicker';
import { Screen } from '../Screen';
import { TextField } from '../TextField';

export interface ReportEditFormProps {
  report: Pick<Report, 'id' | 'type' | 'text'>;
  onCancel: () => void;
  /** The change was saved. */
  onDone: () => void;
}

/** Why a save failed, in words for the searcher (shared with the route that cannot find the report). */
export const EDIT_MESSAGES = {
  offline: 'אין חיבור: השינויים לא נשמרו. נסה שוב כשיש חיבור.',
  ended: 'הפעילות הסתיימה: אי אפשר לערוך את הדיווח.',
  notOwner: 'אפשר לערוך רק דיווח שאתה שלחת.',
  gone: 'הדיווח כבר לא קיים.',
  other: 'לא ניתן לשמור את השינויים. נסה שוב.',
} as const;

function failureMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return EDIT_MESSAGES.other;
  if (error.code === 'NETWORK_ERROR') return EDIT_MESSAGES.offline;
  if (error.code === 'MISSION_ENDED') return EDIT_MESSAGES.ended;
  if (error.code === 'FORBIDDEN') return EDIT_MESSAGES.notOwner;
  if (error.code === 'NOT_FOUND') return EDIT_MESSAGES.gone;
  return EDIT_MESSAGES.other;
}

/**
 * The report's author edits its category and text (UC-C11, decision 88). The place and the photo stay as they were, and
 * only what changed is sent. Saving needs a connection; a failure keeps what was typed so it can be tried again.
 */
export function ReportEditForm({ report, onCancel, onDone }: ReportEditFormProps) {
  const update = useUpdateReport();
  const [type, setType] = useState(report.type);
  const [text, setText] = useState(report.text);
  const [textError, setTextError] = useState<string | null>(null);

  const trimmed = text.trim();
  const changed = type !== report.type || trimmed !== report.text;
  const saving = update.isPending;

  function save() {
    if (saving || !changed) return;
    if (!trimmed) {
      setTextError('כתוב מה ראית.');
      return;
    }
    setTextError(null);
    const body = {
      ...(type !== report.type && { type }),
      ...(trimmed !== report.text && { text: trimmed }),
    };
    if (!UpdateReportBody.safeParse(body).success) {
      setTextError('הדיווח לא תקין.');
      return;
    }
    update.mutate({ reportId: report.id, body }, { onSuccess: onDone });
  }

  return (
    <Screen
      title="עריכת דיווח"
      leading={<Button label="ביטול" icon="close" variant="ghost" onPress={onCancel} />}
      footer={
        <Button
          label={saving ? 'שומר…' : 'שמור שינויים'}
          variant="primary"
          size="lg"
          block
          icon="check"
          disabled={saving || !changed}
          onPress={save}
        />
      }
    >
      <ReportTypePicker value={type} onChange={setType} />
      <TextField
        label="פירוט"
        multiline
        tall
        numberOfLines={4}
        maxLength={REPORT_TEXT_MAX}
        value={text}
        onChangeText={setText}
        error={textError}
        editable={!saving}
      />
      <Notice icon="lock">המיקום והתמונה לא ניתנים לשינוי. השינוי נשמר רק כשיש חיבור.</Notice>
      {update.isError ? (
        <Notice tone="warn" icon="alert" live>
          {failureMessage(update.error)}
        </Notice>
      ) : null}
    </Screen>
  );
}
