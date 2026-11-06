import { spacing, typography } from '@trace/design';
import { Platform, Pressable, StyleSheet, Text, type GestureResponderEvent, type PressableProps } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Icon, type IconName } from '../Icon';

export interface TabButtonProps {
  label: string;
  icon: IconName;
  /** SOS keeps its danger color, also when it is the current tab (Fm12). */
  tone?: 'danger';
  /** From Expo Router's `TabTrigger` (asChild): the tab's URL, whether it is current, and its press handlers. */
  href?: string;
  isFocused?: boolean;
  onPress?: PressableProps['onPress'];
  onLongPress?: PressableProps['onLongPress'];
}

const hasModifier = (event: GestureResponderEvent) => {
  const e = event.nativeEvent as unknown as Partial<MouseEvent>;
  return !!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) || (e.button ?? 0) !== 0;
};

/**
 * One destination in the mission tab bar (wireframe `.tcx-tabbar a`). Screen navigation, so a link marked as the
 * current page, not a tab (SegmentedTabs guidelines). On the web it is a real `<a href>`, so the keyboard and the
 * browser treat it as a link. Used as the `asChild` of an Expo Router `TabTrigger`; the trigger's own row style is
 * deliberately not applied.
 */
export function TabButton({ label, icon, tone, href, isFocused = false, onPress, onLongPress }: TabButtonProps) {
  const { color } = useTheme().theme;
  const ink = tone === 'danger' ? color.dangerInk : isFocused ? color.accent : color.inkSecondary;
  const web = Platform.OS === 'web';

  const handlePress = (event: GestureResponderEvent) => {
    onPress?.(event);
    // The router has navigated; stop the browser from also following the link, unless the user asked for a new tab.
    if (web && href && !hasModifier(event)) event.preventDefault();
  };

  // `href` renders an anchor in react-native-web; `aria-current` is web only, native screen readers read `selected`.
  const linkProps = web ? { href, 'aria-current': isFocused ? ('page' as const) : undefined } : {};

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={web ? undefined : { selected: isFocused }}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tab, pressed && { backgroundColor: color.surfaceHover }]}
      {...linkProps}
    >
      <Icon name={icon} color={ink} large />
      <Text style={[typography.caption, isFocused && styles.focused, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space1,
    minHeight: pendingTokens.touchTarget,
  },
  focused: { fontWeight: typography.bodyStrong.fontWeight },
});
