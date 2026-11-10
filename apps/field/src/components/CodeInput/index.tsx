import { radius, spacing, typography } from '@trace/design';
import { OTP_LENGTH } from '@trace/schemas';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

export interface CodeInputProps {
  /** The digits typed so far. */
  value: string;
  onChange: (digits: string) => void;
  /** Called with the code as soon as the last digit is typed. */
  onComplete: (code: string) => void;
  invalid?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
}

const label = `קוד אימות, ${OTP_LENGTH} ספרות`;

/**
 * The sign-in code of Fm01 (`.tcx-otp`): one cell per digit, drawn over a single transparent input, so the keyboard's
 * code suggestion from the SMS fills it in one go and a screen reader finds one field.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  editable = true,
  autoFocus,
}: CodeInputProps) {
  const { color } = useTheme().theme;
  const [focused, setFocused] = useState(false);

  const change = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH) onComplete(digits);
  };

  return (
    <View style={styles.field}>
      <Text importantForAccessibility="no" aria-hidden style={[typography.body, { color: color.inkMuted }]}>
        {label}
      </Text>
      <View>
        <View style={styles.cells} importantForAccessibility="no-hide-descendants" aria-hidden>
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const next = focused && i === value.length;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    backgroundColor: color.surfaceSunken,
                    borderColor: invalid ? color.warning : next ? color.accent : color.borderField,
                  },
                  next && {
                    outlineStyle: 'solid',
                    outlineWidth: pendingTokens.focusRing,
                    outlineOffset: pendingTokens.focusRing,
                    outlineColor: color.focus,
                  },
                ]}
              >
                <Text style={[styles.digit, { color: color.ink }]}>{value[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel={label}
          aria-invalid={invalid}
          value={value}
          onChangeText={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          caretHidden
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space3 },
  cells: { direction: 'ltr', flexDirection: 'row', gap: spacing.space4 },
  cell: {
    flex: 1,
    height: pendingTokens.otpCellH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: pendingTokens.strongBorder,
    borderRadius: radius.radiusLg,
  },
  digit: {
    fontFamily: typography.title.fontFamily,
    fontWeight: typography.callsign.fontWeight,
    fontSize: pendingTokens.otpDigitSize,
  },
  input: { ...StyleSheet.absoluteFill, opacity: 0 },
});
