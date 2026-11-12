import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { FieldError } from '../FieldError';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'accessibilityLabel'> {
  /** Shown above the input and read as its name. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** The one message under the field; marks it invalid. It never blocks another try. */
  error?: string | null;
  /** Latin values such as a phone number: written left to right (`.tc-input--ltr`). */
  ltr?: boolean;
}

/** Trace Console TextField for React Native: a label above an input, with its error under it. */
export function TextField({ label, error, ltr = false, editable, multiline, ...props }: TextFieldProps) {
  const { color } = useTheme().theme;
  return (
    <View style={styles.field}>
      <Text importantForAccessibility="no" aria-hidden style={[typography.meta, { color: color.inkSecondary }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        aria-invalid={!!error}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={color.inkMuted}
        style={[
          styles.input,
          typography.body,
          {
            color: color.ink,
            backgroundColor: color.surfaceSunken,
            borderColor: error ? color.warning : color.borderField,
          },
          multiline && styles.multiline,
          ltr && styles.ltr,
          editable === false && styles.disabled,
        ]}
        {...props}
      />
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 },
  input: {
    minHeight: pendingTokens.controlHLg,
    paddingHorizontal: spacing.space5,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
  // A text area (Fm09): taller than a single line, text from the top.
  multiline: { minHeight: pendingTokens.textAreaMinH, paddingVertical: spacing.space4, textAlignVertical: 'top' },
  // The page is right to left, so the end of the field is its right edge (`.tc-input--ltr`). RN has no `end` alignment.
  ltr: { writingDirection: 'ltr', textAlign: 'right' },
  disabled: { opacity: pendingTokens.disabledOpacity },
});
