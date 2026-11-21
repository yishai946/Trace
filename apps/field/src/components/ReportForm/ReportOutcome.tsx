import type { ReportType } from '@trace/domain';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { Screen } from '../Screen';

const LOCATED_NOT_SENT =
  'הדיווח "הנעדר אותר" לא הגיע למנהל. אין חיבור: הדיווח נשמר במכשיר ויישלח אוטומטית כשהחיבור יחזור. עד אז המנהל לא יודע עליו.';

const REJECTED = 'הדיווח לא התקבל: הפעילות הסתיימה או שהגישה שלך הוסרה. המנהל לא קיבל את הדיווח.';
const LOCATED_REJECTED =
  'הדיווח "הנעדר אותר" לא התקבל: הפעילות הסתיימה או שהגישה שלך הוסרה. המנהל לא קיבל את הדיווח, ויש לעדכן אותו בדרך אחרת.';

interface ReportOutcomeProps {
  outcome: 'rejected' | 'located-pending';
  type: ReportType | null;
  onDone: () => void;
}

/** What the searcher sees when the report was not accepted, or a "הנעדר אותר" report waits on the phone. */
export function ReportOutcome({ outcome, type, onDone }: ReportOutcomeProps) {
  const rejected = outcome === 'rejected';
  return (
    <Screen
      title="דיווח חדש"
      footer={<Button key="back" label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />}
    >
      <Notice tone="warn" icon={rejected ? 'alert' : 'wifiOff'} live>
        {rejected ? (type === 'located' ? LOCATED_REJECTED : REJECTED) : LOCATED_NOT_SENT}
      </Notice>
    </Screen>
  );
}
