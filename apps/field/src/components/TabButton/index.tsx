import { spacing, typography } from '@trace/design';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';

export interface TabButtonProps extends Omit<TabTriggerSlotProps, 'children' | 'style' | 'ref'> {
  label: string;
  icon: IconName;
  tone?: 'danger';
}

/**
 * One destination in the mission tab bar (wireframe `.tcx-tabbar`). Screen navigation, so a link marked as the
 * current one, not a tab (SegmentedTabs guidelines). Used as the `asChild` of an Expo Router `TabTrigger`.
 */
export function TabButton({ label, icon, tone, isFocused = false, href: _href, ...props }: TabButtonProps) {
  const { color } = useTheme().theme;
  const ink = isFocused ? color.accent : tone === 'danger' ? color.dangerInk : color.inkSecondary;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      aria-selected={isFocused}
      style={({ pressed }) => [styles.tab, pressed && { backgroundColor: color.surfaceHover }]}
      {...props}
    >
      <Icon name={icon} color={ink} large />
      <Text style={[typography.caption, isFocused && styles.focused, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.space1 },
  focused: { fontWeight: typography.bodyStrong.fontWeight },
});
