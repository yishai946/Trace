import { radius, spacing, typography } from '@trace/design';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Icon, type IconName } from '../Icon';

export interface TabButtonProps {
  label: string;
  icon: IconName;
  /** SOS keeps its danger color, also when it is the current tab (Fm12). */
  tone?: 'danger';
  /** A count on the tab, e.g. the messages that wait for the searcher (Fm11); nothing when zero. */
  count?: number;
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
export function TabButton({
  label,
  icon,
  tone,
  count = 0,
  href,
  isFocused = false,
  onPress,
  onLongPress,
}: TabButtonProps) {
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
      accessibilityLabel={count > 0 ? `${label}, ${count} חדשות` : label}
      accessibilityState={web ? undefined : { selected: isFocused }}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tab, pressed && { backgroundColor: color.surfaceHover }]}
      {...linkProps}
    >
      <Icon name={icon} color={ink} large />
      <Text style={[typography.caption, isFocused && styles.focused, { color: ink }]}>{label}</Text>
      {count > 0 ? (
        <View style={[styles.count, { backgroundColor: color.accent }]}>
          <Text style={[typography.caption, styles.countText, { color: color.surface }]}>{count}</Text>
        </View>
      ) : null}
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
  count: {
    position: 'absolute',
    top: pendingTokens.tabBadgeTop,
    start: '50%',
    marginStart: spacing.space3,
    minWidth: pendingTokens.tabBadge,
    height: pendingTokens.tabBadge,
    borderRadius: radius.radiusLg,
    paddingHorizontal: spacing.space2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontWeight: typography.bodyStrong.fontWeight },
  focused: { fontWeight: typography.bodyStrong.fontWeight },
});
