import { typography } from '@trace/design';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { FieldError } from '../FieldError';
import type { SightingStatus } from './useSightingDraft';

interface SightingFooterProps {
  status: SightingStatus;
  onSubmit: () => void;
  /** Back to the map. */
  onDone: () => void;
}

const pendingText = 'אין חיבור. התצפית נשמרה בטלפון ותישלח אוטומטית כשהחיבור יחזור.';
const retryingText = 'השרת לא קיבל את התצפית. היא נשמרה בטלפון ותישלח שוב אוטומטית.';
const rejectedText = 'התצפית לא נשלחה: המסע הסתיים או שהפעילות שלך בו הסתיימה.';
const invalidText = 'התצפית לא נשלחה: השרת דחה אותה. נסה לדווח שוב.';

/** Under the form: the send button, or what happened to the sighting once it was sent or kept on the phone. */
export function SightingFooter({ status, onSubmit, onDone }: SightingFooterProps) {
  const { color } = useTheme().theme;
  const sending = status === 'sending';
  const savedText = status === 'pending' ? pendingText : status === 'retrying' ? retryingText : null;
  return savedText ? (
    <>
      <Text accessibilityLiveRegion="polite" style={[typography.body, { color: color.ink }]}>
        {savedText}
      </Text>
      <Button key="back" label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
    </>
  ) : status === 'rejected' || status === 'invalid' ? (
    <>
      <FieldError message={status === 'rejected' ? rejectedText : invalidText} />
      <Button key="back" label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
    </>
  ) : (
    <>
      {status === 'save-failed' ? <FieldError message="לא ניתן לשמור את התצפית בטלפון. נסה שוב." /> : null}
      {/* A key of its own: react-native-web applies a reused button's new press handler only after paint, so "חזרה
          למפה" must not reuse the disabled "שולח…" button. */}
      <Button
        key="send"
        label={sending ? 'שולח…' : 'שלח תצפית'}
        variant="primary"
        size="lg"
        block
        icon="send"
        disabled={sending}
        onPress={onSubmit}
      />
      <Text style={[typography.caption, styles.caption, { color: color.inkMuted }]}>
        התצפית תופיע מיד במפה של המנהל
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  caption: { textAlign: 'center' },
});
