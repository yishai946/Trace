import { typography, radius, spacing } from '@trace/design';
import { OTP_LENGTH } from '@trace/schemas';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCountdown } from '../../auth';
import { formatPhone } from '../../auth/phone';
import { ltr } from '../../i18n/rtl';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { AuthLayout } from '../AuthLayout';
import { Button } from '../Button';
import { CodeInput } from '../CodeInput';
import { FieldError } from '../FieldError';

export interface CodeStepProps {
  /** E.164, as sent to the API. */
  phoneNumber: string;
  code: string;
  onCodeChange: (code: string) => void;
  onVerify: (code: string) => void;
  verifyPending: boolean;
  /** The code was right but the profile failed to load: the primary action retries that instead of verifying. */
  profileFailed: boolean;
  onRetryProfile: () => void;
  onResend: () => void;
  resendPending: boolean;
  /** Seconds the server asked to wait before another code; 0 when none. */
  countdown: number;
  onChangeNumber: () => void;
  /** The verify or resend refusal, if any. */
  error: string | null;
  /** A confirmation such as "נשלח קוד חדש". */
  notice: string | null;
}

/** Fm01, step 2: the code from the SMS. A wrong or expired code shows an error and leaves "שלח קוד חדש" ready. */
export function CodeStep({
  phoneNumber,
  code,
  onCodeChange,
  onVerify,
  verifyPending,
  profileFailed,
  onRetryProfile,
  onResend,
  resendPending,
  countdown,
  onChangeNumber,
  error,
  notice,
}: CodeStepProps) {
  const { color } = useTheme().theme;
  return (
    <AuthLayout
      heading="הזן את הקוד שנשלח אליך"
      steps={{ labels: ['טלפון', 'אימות'], current: 1 }}
      footer={
        <>
          <Button
            variant="ghost"
            size="lg"
            block
            label={countdown > 0 ? `שלח קוד חדש בעוד ${ltr(formatCountdown(countdown))}` : 'שלח קוד חדש'}
            disabled={countdown > 0 || resendPending}
            onPress={onResend}
          />
          <Button
            variant="primary"
            size="lg"
            block
            label={verifyPending ? 'מאמת…' : profileFailed ? 'נסה שוב' : 'אמת והמשך'}
            disabled={verifyPending || (!profileFailed && code.length < OTP_LENGTH)}
            onPress={() => (profileFailed ? onRetryProfile() : onVerify(code))}
          />
        </>
      }
    >
      <View style={[styles.card, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
        <View style={styles.row}>
          <Text style={[typography.meta, { color: color.inkMuted }]}>טלפון</Text>
          <Text style={[typography.bodyStrong, styles.phone, { color: color.ink }]}>
            {ltr(formatPhone(phoneNumber))}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="שנה מספר"
            onPress={onChangeNumber}
            style={styles.change}
          >
            <Text style={[typography.body, { color: color.accent }]}>שנה מספר</Text>
          </Pressable>
        </View>
      </View>
      <CodeInput
        value={code}
        onChange={onCodeChange}
        onComplete={(c) => {
          if (!verifyPending) onVerify(c);
        }}
        invalid={!!error}
        autoFocus
        editable={!verifyPending}
      />
      {error ? (
        <FieldError message={error} />
      ) : notice ? (
        <Text accessibilityLiveRegion="polite" style={[typography.meta, { color: color.inkSecondary }]}>
          {notice}
        </Text>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.space2,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusLg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space5, minHeight: pendingTokens.controlHLg },
  phone: { flex: 1 },
  change: { minHeight: pendingTokens.touchTarget, justifyContent: 'center', paddingHorizontal: spacing.space2 },
});
