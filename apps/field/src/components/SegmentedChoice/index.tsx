import { radius, spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

export interface SegmentedChoiceProps<T extends string> {
  /** The group's name for screen readers; the form shows its own visible label above. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * One choice out of a few, as segments in a sunken rail (Trace Console `.tc-seg`, Fm09). The tabs of SegmentedTabs
 * switch a view; here the segments set a value, so they are radios in a radio group.
 */
export function SegmentedChoice<T extends string>({ label, options, value, onChange }: SegmentedChoiceProps<T>) {
  const { color } = useTheme().theme;
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label={label}
      style={[styles.rail, { backgroundColor: color.surfaceSunken }]}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            aria-checked={checked}
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: checked ? color.surfaceRaised : pressed ? color.surfaceHover : 'transparent' },
            ]}
          >
            <Text
              style={[
                checked ? typography.bodyStrong : typography.body,
                { color: checked ? color.ink : color.inkSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', padding: spacing.space2, borderRadius: radius.radiusLg },
  option: {
    flex: 1,
    minHeight: pendingTokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.radiusMd,
  },
});
