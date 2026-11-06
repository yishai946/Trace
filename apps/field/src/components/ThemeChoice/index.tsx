import { radius, spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePreferences, type ThemePreference } from '../../state/preferences';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

const options: { value: ThemePreference; label: string }[] = [
  { value: 'day', label: 'יום' },
  { value: 'night', label: 'לילה' },
  { value: 'system', label: 'לפי המכשיר' },
];

/** "ערכת צבעים": day, night or the device setting (ProfileMenu guidelines). Changes every screen and the map. */
export function ThemeChoice() {
  const { color } = useTheme().theme;
  const preference = usePreferences((s) => s.themePreference);
  const setPreference = usePreferences((s) => s.setThemePreference);

  return (
    <View style={styles.field}>
      <Text style={[typography.meta, { color: color.inkMuted }]}>ערכת צבעים</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="ערכת צבעים"
        style={[styles.rail, { backgroundColor: color.surfaceSunken }]}
      >
        {options.map((option) => {
          const checked = option.value === preference;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              aria-checked={checked}
              onPress={() => setPreference(option.value)}
              style={[styles.option, checked && { backgroundColor: color.surfaceRaised }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 },
  // SegmentedTabs look: a sunken rail with the chosen option raised.
  rail: { flexDirection: 'row', padding: spacing.space1, borderRadius: radius.radiusLg, gap: spacing.space1 },
  option: {
    flex: 1,
    minHeight: pendingTokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.radiusMd,
  },
});
