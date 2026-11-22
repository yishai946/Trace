import type { ReportType } from '@trace/domain';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { Screen } from '../Screen';

const LOCATED_NOT_SENT =
  'הדיווח "הנעדר אותר" לא הגיע למנהל. אין חיבור: הדיווח נשמר במכשיר ויישלח אוטומטית כשהחיבור יחזור. עד אז המנהל לא יודע עליו.';

const LOCATED_RETRYING =
  'השרת לא קיבל את הדיווח "הנעדר אותר". הדיווח נשמר במכשיר וישלח שוב אוטומטית. עד אז המנהל לא יודע עליו.';
const INVALID = 'הדיווח לא נשלח: השרת דחה אותו. נסה לדווח שוב.';
const LOCATED_INVALID =
  'הדיווח "הנעדר אותר" לא נשלח: השרת דחה אותו. המנהל לא קיבל אותו, נסה לדווח שוב או עדכן אותו בדרך אחרת.';

const REJECTED = 'הדיווח לא התקבל: הפעילות הסתיימה או שהגישה שלך הוסרה. המנהל לא קיבל את הדיווח.';
const LOCATED_REJECTED =
  'הדיווח "הנעדר אותר" לא התקבל: הפעילות הסתיימה או שהגישה שלך הוסרה. המנהל לא קיבל את הדיווח, ויש לעדכן אותו בדרך אחרת.';

interface ReportOutcomeProps {
  outcome: 'rejected' | 'invalid' | 'located-pending' | 'located-retrying';
  type: ReportType | null;
  onDone: () => void;
}

/** What the searcher sees when the report was not accepted, or a "הנעדר אותר" report waits on the phone. */
export function ReportOutcome({ outcome, type, onDone }: ReportOutcomeProps) {
  const located = type === 'located';
  const rejected = outcome === 'rejected' || outcome === 'invalid';
  const text = {
    rejected: located ? LOCATED_REJECTED : REJECTED,
    invalid: located ? LOCATED_INVALID : INVALID,
    'located-pending': LOCATED_NOT_SENT,
    'located-retrying': LOCATED_RETRYING,
  }[outcome];
  return (
    <Screen
      title="דיווח חדש"
      footer={<Button key="back" label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />}
    >
      <Notice tone="warn" icon={rejected ? 'alert' : 'wifiOff'} live>
        {text}
      </Notice>
    </Screen>
  );
}
