import { SOS_MESSAGE_MAX_LENGTH } from '@trace/schemas';
import { formatCallsign } from '@trace/domain';
import { formatLatLng } from '@trace/geo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography, spacing } from '@trace/design';
import { ltr } from '../../i18n/rtl';
import type { CurrentFix } from '../../location/useCurrentFix';
import { useTheme } from '../../theme';
import { Notice } from '../Notice';
import { SosHoldButton } from '../SosHoldButton';
import { SosFacts } from '../SosFacts';
import { TextField } from '../TextField';

export interface SosActivationProps {
  callsign: number | null;
  polygonName: string | null;
  /** The phone's fix taken when the screen opened; null when there is none (the server then uses the last known one). */
  fix: CurrentFix | null;
  sending: boolean;
  /** The last send failed; the message stays in the field for the next try. */
  failed: boolean;
  /** How the searcher's previous SOS ended, as a sentence. */
  endedNote: string | null;
  onActivate: (message: string) => void;
}

/** Fm12 before an SOS: the hold button, who and where it is sent from, and an optional short message (decision 24). */
export function SosActivation({
  callsign,
  polygonName,
  fix,
  sending,
  failed,
  endedNote,
  onActivate,
}: SosActivationProps) {
  const { color } = useTheme().theme;
  const [message, setMessage] = useState('');
  const sentTo = polygonName
    ? `נשלח למנהל ולמחפשים בפוליגון ${polygonName}, עם זהות ומיקום.`
    : 'נשלח למנהל, עם זהות ומיקום.';
  return (
    <View style={styles.stack}>
      {endedNote ? <Notice icon="check">{endedNote}</Notice> : null}
      <SosHoldButton sending={sending} onActivate={() => onActivate(message)} />
      <Text
        style={[typography.meta, styles.center, { color: color.inkSecondary }]}
      >{`לחיצה ארוכה להפעלה. ${sentTo}`}</Text>
      <SosFacts
        rows={[
          { label: 'נשלח כ-', value: callsign === null ? 'לא ידוע' : formatCallsign(callsign) },
          {
            label: 'מיקום',
            value: fix
              ? `${ltr(formatLatLng(fix.position))}${fix.accuracy === null ? '' : ` ±${ltr(Math.round(fix.accuracy))} מ׳`}`
              : 'לא זמין, יישלח המיקום האחרון הידוע',
          },
        ]}
      />
      <TextField
        label="הודעה קצרה (אופציונלי)"
        value={message}
        onChangeText={setMessage}
        placeholder="לדוגמה: נפלתי, כאב ברגל"
        maxLength={SOS_MESSAGE_MAX_LENGTH}
        editable={!sending}
      />
      <Text
        style={[typography.meta, { color: color.inkMuted }]}
      >{`${ltr(message.length)}/${ltr(SOS_MESSAGE_MAX_LENGTH)}`}</Text>
      {failed ? (
        <Notice icon="alert" tone="warn" live>
          ה-SOS לא נשלח. בדוק את החיבור ונסה שוב. ההודעה נשמרה.
        </Notice>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space6 },
  center: { textAlign: 'center' },
});
