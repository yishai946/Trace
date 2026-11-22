import type { ReportType } from '@trace/domain';
import { CreateReportBody } from '@trace/schemas';
import { useRef, useState } from 'react';
import { useCurrentFix } from '../../location/useCurrentFix';
import { type Delivery, newReportId, submitReport } from '../../reports/submit';
import type { ReportPhotoValue } from '../ReportPhoto';

export type ReportPhase =
  'editing' | 'sending' | 'sent' | 'located-pending' | 'located-retrying' | 'rejected' | 'invalid';

/** The screen that says what became of the report, or null when it was sent or waits and the form is simply done. */
function outcomePhase(delivery: Delivery, type: ReportType): ReportPhase | null {
  if (delivery === 'sent' || delivery === 'rejected' || delivery === 'invalid') return delivery;
  if (type !== 'located') return null;
  return delivery === 'pending' ? 'located-pending' : delivery === 'retrying' ? 'located-retrying' : null;
}

interface Input {
  missionId: string;
  /** The report was sent, kept on the phone to be sent, or the searcher left the screen that says it was not accepted. */
  onDone: () => void;
}

/** The report form (UC-F09): what was entered, the position fix, and keeping the report on the phone and sending it. */
export function useReportDraft({ missionId, onDone }: Input) {
  const fix = useCurrentFix();
  const [type, setType] = useState<ReportType | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ReportPhotoValue | null>(null);
  const [errors, setErrors] = useState<{ type?: string; text?: string }>({});
  const [phase, setPhase] = useState<ReportPhase>('editing');
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
      const next = outcomePhase(delivery, type);
      if (next) setPhase(next);
      else onDone();
    } catch {
      // Nothing was saved on the phone: keep the form so the searcher can try again.
      setSaveError('לא ניתן לשמור את הדיווח במכשיר. נסה שוב.');
      setPhase('editing');
    } finally {
      sending.current = false;
    }
  }

  return { fix, type, setType, text, setText, photo, setPhoto, errors, phase, saveError, submit };
}
