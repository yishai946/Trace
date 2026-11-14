import { radius, spacing } from '@trace/design';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Icon } from '../Icon';

export type ReportsView = 'list' | 'map';

const options = [
  { value: 'list', label: 'רשימה', icon: 'list' },
  { value: 'map', label: 'מפה', icon: 'map' },
] as const;

/**
 * Switches a screen between its list and its map (Fm10): two icon-only segments of `.tc-seg`, each named for screen
 * readers. They set a value, so they are radios in a radio group, as in SegmentedChoice.
 */
export function ViewToggle({ value, onChange }: { value: ReportsView; onChange: (value: ReportsView) => void }) {
  const { color } = useTheme().theme;
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label="תצוגה"
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
            style={[styles.option, { backgroundColor: checked ? color.surfaceRaised : 'transparent' }]}
          >
            <Icon name={option.icon} color={checked ? color.ink : color.inkSecondary} large />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    width: pendingTokens.viewToggleW,
    padding: spacing.space2,
    borderRadius: radius.radiusLg,
  },
  option: {
    flex: 1,
    minHeight: pendingTokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.radiusMd,
  },
});
