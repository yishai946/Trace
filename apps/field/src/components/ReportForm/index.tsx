import type { ReportType } from '@trace/domain';
import { CreateReportBody, REPORT_TEXT_MAX } from '@trace/schemas';
import { useRef, useState } from 'react';
import { newReportId, submitReport } from '../../reports/submit';
import { useReportFix } from '../../reports/useReportFix';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { ReportLocation } from '../ReportLocation';
import { ReportPhoto, type ReportPhotoValue } from '../ReportPhoto';
import { ReportTypePicker } from '../ReportTypePicker';
import { Screen } from '../Screen';
import { TextField } from '../TextField';

export interface ReportFormProps {
  missionId: string;
  /** The searcher's polygon, shown with the location; null for an Available searcher. */
  polygonName: string | null;
  onCancel: () => void;
  /** The report was sent, or kept on the phone to be sent. */
  onDone: () => void;
}

type Phase = 'editing' | 'sending' | 'located-pending';

const LOCATED_NOT_SENT =
  'הדיווח "הנעדר אותר" לא הגיע למנהל. אין חיבור: הדיווח נשמר במכשיר ויישלח אוטומטית כשהחיבור יחזור. עד אז המנהל לא יודע עליו.';

/**
 * Fm08, a new field report (UC-F09): category, details, an optional photo and the position the phone attaches. The
 * report is first kept on the phone and then sent, so without a connection it waits and goes out by itself. A
 * "הנעדר אותר" report that waits gets a prominent warning: the commander has not heard of it.
 */
export function ReportForm({ missionId, polygonName, onCancel, onDone }: ReportFormProps) {
  const fix = useReportFix();
  const [type, setType] = useState<ReportType | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ReportPhotoValue | null>(null);
  const [errors, setErrors] = useState<{ type?: string; text?: string }>({});
  const [phase, setPhase] = useState<Phase>('editing');
  const [saveError, setSaveError] = useState<string | null>(null);
  // State updates are not instant, so a second press in the same moment is stopped here.
  const sending = useRef(false);

  async function submit() {
    if (sending.current || phase !== 'editing' || fix.state !== 'ready' || !fix.fix) return;
    const next = {
      ...(type ? {} : { type: 'בחר קטגוריה.' }),
      ...(text.trim() ? {} : { text: 'כתוב מה ראית.' }),
    };
    setErrors(next);
    if (!type || next.text) return;

    const report = {
      id: newReportId(),
      type,
      text: text.trim(),
      position: { type: 'Point' as const, coordinates: fix.fix.position },
      accuracy: fix.fix.accuracy,
      reportedAt: new Date().toISOString(),
    };
    if (!CreateReportBody.safeParse(report).success) {
      setErrors({ text: 'הדיווח לא תקין.' });
      return;
    }

    sending.current = true;
    setSaveError(null);
    setPhase('sending');
    try {
      const delivery = await submitReport({ missionId, report, photo: photo && { base64: photo.base64 } });
      if (delivery === 'pending' && type === 'located') {
        setPhase('located-pending');
      } else {
        onDone();
      }
    } catch {
      // Nothing was saved on the phone: keep the form so the searcher can try again.
      setSaveError('לא ניתן לשמור את הדיווח במכשיר. נסה שוב.');
      setPhase('editing');
    } finally {
      sending.current = false;
    }
  }

  const leading = <Button label="ביטול" icon="close" variant="ghost" onPress={onCancel} />;

  if (phase === 'located-pending') {
    return (
      <Screen
        title="דיווח חדש"
        footer={<Button label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />}
      >
        <Notice tone="warn" icon="wifiOff" live>
          {LOCATED_NOT_SENT}
        </Notice>
      </Screen>
    );
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
