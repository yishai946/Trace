import { radius, spacing, typography } from '@trace/design';
import { formatCallsign } from '@trace/domain';
import { formatLatLng } from '@trace/geo';
import type { Sos } from '@trace/schemas';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { formatTime } from '../../mission/missionArea';
import { canRetry, CLOSE_REASON } from '../../sos/sendFailure/sendFailureText';
import type { SosSendFailure } from '../../sos/sendFailure';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { SosFacts } from '../SosFacts';

export interface SosActiveProps {
  sos: Sos;
  closing: boolean;
  /** Why the last attempt to close it failed, or null. */
  closeFailure: SosSendFailure | null;
  /** Closes the SOS; `onFailed` runs when the attempt fails. */
  onClose: (onFailed: () => void) => void;
}

/** The SOS section's body while the searcher's SOS is active (Fm12 SOS פעיל): what was sent, to whom, and its state. */
export function SosActive({ sos, closing, closeFailure, onClose }: SosActiveProps) {
  const { color } = useTheme().theme;
  const [confirming, setConfirming] = useState(false);
  const sentTo = sos.polygon ? `נשלח למנהל ולמחפשים בפוליגון ${sos.polygon.name}.` : 'נשלח למנהל.';
  const where = sos.location
    ? `${ltr(formatLatLng(sos.location.position.coordinates))}${sos.location.accuracy === null ? '' : ` ±${ltr(Math.round(sos.location.accuracy))} מ׳`}`
    : 'לא ידוע';
  return (
    <View style={styles.stack}>
      <View
        accessibilityLabel="SOS פעיל"
        style={[styles.card, { backgroundColor: color.dangerSurface, borderColor: color.dangerBorder }]}
      >
        <View style={styles.head}>
          <View style={[styles.tag, { backgroundColor: color.danger }]}>
            <Text style={[typography.caption, styles.tagText, { color: color.onDanger }]}>SOS פעיל</Text>
          </View>
          <Text
            style={[typography.meta, { color: color.dangerInkSoft }]}
          >{`הופעל ${ltr(formatTime(sos.activatedAt))}`}</Text>
        </View>
        <Text style={[typography.body, { color: color.ink }]}>{sentTo}</Text>
      </View>
      <SosFacts
        rows={[
          { label: 'נשלח כ-', value: `${formatCallsign(sos.sender.callsign)} ${sos.sender.name}` },
          { label: 'מיקום', value: where },
          ...(sos.message ? [{ label: 'הודעה', value: sos.message }] : []),
          { label: 'סטטוס', value: 'פעיל, נסגר רק על ידי המנהל או על ידך' },
        ]}
      />
      <Text style={[typography.meta, { color: color.inkMuted }]}>כשהמנהל סוגר את האירוע, עדכון הסגירה יופיע כאן.</Text>
      {closeFailure ? (
        <Notice icon="alert" tone="warn" live>
          {CLOSE_REASON[closeFailure]}
        </Notice>
      ) : null}
      {confirming ? (
        <View style={styles.stack}>
          <Notice icon="alert" tone="warn">
            לסגור את ה-SOS? המנהל והמחפשים שקיבלו אותו יקבלו עדכון סגירה.
          </Notice>
          <Button
            label={closing ? 'סוגר…' : 'כן, סגור את ה-SOS'}
            variant="danger"
            size="lg"
            block
            disabled={closing}
            onPress={() => onClose(() => setConfirming(false))}
          />
          <Button label="השאר פעיל" size="lg" block disabled={closing} onPress={() => setConfirming(false)} />
        </View>
      ) : closeFailure && !canRetry(closeFailure) ? null : (
        <Button label="בטל SOS…" size="lg" block onPress={() => setConfirming(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space6 },
  card: { gap: spacing.space5, padding: spacing.space6, borderWidth: 2, borderRadius: radius.radiusLg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space4 },
  tag: { paddingHorizontal: spacing.space4, paddingVertical: spacing.space2, borderRadius: radius.radiusSm },
  tagText: { fontWeight: typography.bodyStrong.fontWeight },
});
