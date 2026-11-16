import { REPORT_TEXT_MAX } from '@trace/schemas';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { ReportLocation } from '../ReportLocation';
import { ReportPhoto } from '../ReportPhoto';
import { ReportTypePicker } from '../ReportTypePicker';
import { Screen } from '../Screen';
import { TextField } from '../TextField';
import { ReportOutcome } from './ReportOutcome';
import { useReportDraft } from './useReportDraft';

export interface ReportFormProps {
  missionId: string;
  /** The searcher's polygon, shown with the location; null for an Available searcher. */
  polygonName: string | null;
  onCancel: () => void;
  /** The report was sent, kept on the phone to be sent, or the searcher left the screen that says it was not accepted. */
  onDone: () => void;
}

/**
 * Fm08, a new field report (UC-F09): category, details, an optional photo and the position the phone attaches. The
 * report is first kept on the phone and then sent, so without a connection it waits and goes out by itself. A
 * "הנעדר אותר" report that waits gets a prominent warning: the commander has not heard of it.
 */
export function ReportForm({ missionId, polygonName, onCancel, onDone }: ReportFormProps) {
  const { fix, type, setType, text, setText, photo, setPhoto, errors, phase, saveError, submit } = useReportDraft({
    missionId,
    onDone,
  });
  const leading = <Button label="ביטול" icon="close" variant="ghost" onPress={onCancel} />;

  if (phase === 'rejected' || phase === 'located-pending') {
    return <ReportOutcome outcome={phase} type={type} onDone={onDone} />;
  }

  return (
    <Screen
      title="דיווח חדש"
      leading={leading}
      footer={
        <Button
          label={phase === 'sending' ? 'שולח…' : 'שלח דיווח'}
          variant="primary"
          size="lg"
          block
          icon="send"
          disabled={phase === 'sending' || fix.state !== 'ready'}
          onPress={() => void submit()}
        />
      }
    >
      <ReportTypePicker value={type} onChange={setType} error={errors.type} />
      <TextField
        label="פירוט"
        multiline
        tall
        numberOfLines={4}
        maxLength={REPORT_TEXT_MAX}
        value={text}
        onChangeText={setText}
        error={errors.text}
        editable={phase !== 'sending'}
      />
      <ReportPhoto photo={photo} onChange={setPhoto} disabled={phase === 'sending'} />
      <ReportLocation state={fix.state} fix={fix.fix} polygonName={polygonName} />
      <Notice icon="wifiOff">אם אין חיבור, הדיווח נשמר במכשיר ויסונכרן אוטומטית.</Notice>
      {saveError ? (
        <Notice tone="warn" icon="alert" live>
          {saveError}
        </Notice>
      ) : null}
    </Screen>
  );
}
