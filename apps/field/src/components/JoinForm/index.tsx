import { radius, spacing, typography } from '@trace/design';
import { isJoinCode, isMissionEnded, joinCodeFromLink } from '@trace/domain';
import type { JoinPreview } from '@trace/schemas';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiRequestError } from '../../api';
import { ltr } from '../../i18n/rtl';
import { useJoinMission, useJoinPreview } from '../../mission/queries';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge, type BadgeTone } from '../Badge';
import { Button } from '../Button';
import { FieldError } from '../FieldError';
import { QrScanner } from '../QrScanner';
import { Screen } from '../Screen';

/** What the searcher typed, as a join code in the making: `k74q2` becomes `K7-4Q2`. A pasted join link gives its code. */
export function toJoinCode(text: string): string {
  const fromLink = text.includes('/') ? joinCodeFromLink(text) : null;
  if (fromLink) return fromLink;
  const chars = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return chars.length > 2 ? `${chars.slice(0, 2)}-${chars.slice(2, 5)}` : chars;
}

const NETWORK = 'אין חיבור לשרת. בדוק את החיבור ונסה שוב.';
const UNKNOWN_CODE = 'לא נמצא מסע עם הקוד הזה. בדוק את הקוד ונסה שוב.';

function previewErrorMessage(error: unknown): string {
  const code = error instanceof ApiRequestError ? error.code : null;
  if (code === 'NETWORK_ERROR') return NETWORK;
  if (code === 'NOT_FOUND') return UNKNOWN_CODE;
  return 'לא ניתן לבדוק את הקוד. נסה שוב.';
}

function joinErrorMessage(error: unknown): string {
  const code = error instanceof ApiRequestError ? error.code : null;
  if (code === 'NETWORK_ERROR') return NETWORK;
  if (code === 'NOT_FOUND') return UNKNOWN_CODE;
  if (code === 'MISSION_NOT_ACTIVE') return 'המסע אינו פעיל כרגע, ואי אפשר להצטרף אליו.';
  if (code === 'MISSION_FULL') return 'המסע מלא. פנה למנהל המסע.';
  return 'ההצטרפות נכשלה. נסה שוב.';
}

function statusBadge(status: JoinPreview['status']): { label: string; tone: BadgeTone } {
  if (status === 'active') return { label: 'פעיל', tone: 'ok' };
  if (isMissionEnded(status)) return { label: 'הסתיים', tone: 'neutral' };
  return { label: 'מושהה', tone: 'warn' };
}

export interface JoinFormProps {
  /** The searcher is in the mission: a new participation, or the one they already had. */
  onJoined: () => void;
  onOpenMyMissions: () => void;
  /** False while another screen covers this one: only one camera preview can run at a time. */
  scanning?: boolean;
}

/**
 * Fm02: join a mission by scanning its QR, opening its link or typing its code (UC-F02, decision 6). All three end in
 * the same code; the mission behind it is shown before the searcher confirms.
 */
export function JoinForm({ onJoined, onOpenMyMissions, scanning = true }: JoinFormProps) {
  const { color } = useTheme().theme;
  const [code, setCode] = useState(() => useSession.getState().pendingJoinCode ?? '');
  const complete = isJoinCode(code) ? code : null;
  const preview = useJoinPreview(complete);
  const join = useJoinMission();

  const change = (text: string) => {
    join.reset();
    setCode(toJoinCode(text));
  };
  const scanned = (text: string) => {
    const found = joinCodeFromLink(text);
    if (found && found !== code) change(found);
  };
  const mission = complete ? preview.data : undefined;
  const error = join.isError
    ? joinErrorMessage(join.error)
    : complete && preview.isError
      ? previewErrorMessage(preview.error)
      : null;

  return (
    <Screen
      title="הצטרפות למסע"
      action={<Button label="המסעות שלי" variant="ghost" onPress={onOpenMyMissions} />}
      footer={
        <Button
          label="אשר והצטרף"
          variant="primary"
          size="lg"
          block
          disabled={!mission || join.isPending}
          onPress={() => complete && join.mutate(complete, { onSuccess: onJoined })}
        />
      }
    >
      {scanning ? <QrScanner onScan={scanned} /> : null}
      <View style={styles.or}>
        <View style={[styles.rule, { backgroundColor: color.borderSubtle }]} />
        <Text style={[typography.meta, { color: color.inkMuted }]}>או</Text>
        <View style={[styles.rule, { backgroundColor: color.borderSubtle }]} />
      </View>
      <View style={styles.field}>
        <Text importantForAccessibility="no" aria-hidden style={[typography.meta, { color: color.inkMuted }]}>
          קוד הצטרפות
        </Text>
        <TextInput
          accessibilityLabel="קוד הצטרפות"
          aria-invalid={!!error}
          value={code}
          onChangeText={change}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={64}
          placeholder={ltr('K7-4Q2')}
          placeholderTextColor={color.inkMuted}
          style={[
            styles.input,
            styles.code,
            {
              color: color.ink,
              backgroundColor: color.surfaceSunken,
              borderColor: error ? color.warning : color.borderField,
            },
          ]}
        />
        <Text style={[typography.caption, { color: color.inkMuted }]}>קישור הצטרפות פותח מסך זה עם הקוד ממולא</Text>
      </View>
      {error ? <FieldError message={error} /> : null}
      {complete && preview.isPending ? (
        <ActivityIndicator color={color.inkMuted} accessibilityLabel="בודק את הקוד" />
      ) : null}
      {mission ? (
        <View
          accessibilityLabel="אישור הצטרפות"
          style={[styles.card, { backgroundColor: color.surfaceSunken, borderColor: color.borderStrong }]}
        >
          <Text style={[typography.meta, { color: color.inkMuted }]}>אישור הצטרפות</Text>
          <Text style={[typography.title, { color: color.ink }]}>{mission.name}</Text>
          {mission.missingPerson.name ? (
            <Text style={[typography.body, { color: color.inkSecondary }]}>
              {`נעדר: ${mission.missingPerson.name}`}
              {mission.missingPerson.age === null ? '' : `, ${ltr(mission.missingPerson.age)}`}
            </Text>
          ) : null}
          <Badge dot {...statusBadge(mission.status)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.space5 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  field: { gap: spacing.space2 },
  input: {
    minHeight: pendingTokens.controlHLg,
    paddingHorizontal: spacing.space5,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
  code: {
    fontFamily: typography.bodyStrong.fontFamily,
    fontWeight: typography.callsign.fontWeight,
    fontSize: pendingTokens.joinCodeSize,
    letterSpacing: pendingTokens.joinCodeSpacing,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  card: {
    gap: spacing.space2,
    padding: spacing.space6,
    borderWidth: pendingTokens.cardStrongBorder,
    borderRadius: radius.radiusLg,
  },
});
