import { typography } from '@trace/design';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { FieldError } from '../FieldError';
import type { SightingStatus } from './useSightingDraft';

interface SightingFooterProps {
  status: SightingStatus;
  sending: boolean;
  onSubmit: () => void;
  /** Back to the map. */
  onDone: () => void;
}

/** Under the form: the send button, or what happened to the sighting once it was sent or kept on the phone. */
export function SightingFooter({ status, sending, onSubmit, onDone }: SightingFooterProps) {
  const { color } = useTheme().theme;
  return status === 'pending' ? (
    <>
      <Text accessibilityLiveRegion="polite" style={[typography.body, { color: color.ink }]}>
        אין חיבור. התצפית נשמרה בטלפון ותישלח אוטומטית כשהחיבור יחזור.
      </Text>
      <Button label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
    </>
  ) : status === 'rejected' ? (
    <>
      <FieldError message="התצפית לא נשלחה: המסע הסתיים או שהפעילות שלך בו הסתיימה." />
      <Button label="חזרה למפה" variant="primary" size="lg" block onPress={onDone} />
    </>
  ) : (
    <>
      {status === 'save-failed' ? <FieldError message="לא ניתן לשמור את התצפית בטלפון. נסה שוב." /> : null}
      <Button
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
