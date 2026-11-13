import { size, spacing, typography } from '@trace/design';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export interface ScreenProps {
  /** Shown in the top bar and announced as the screen's heading. */
  title: string;
  /** Before the title, at the start of the bar (e.g. "ביטול" on a new report, Fm08). */
  leading?: ReactNode;
  /** After the title, at the end of the bar (e.g. "המסעות שלי" on the join screen, Fm02). */
  action?: ReactNode;
  children: ReactNode;
  /** Pinned under the content, e.g. the screen's main action. */
  footer?: ReactNode;
  /** A mission screen above the tab bar, which already keeps clear of the home indicator. */
  tabbed?: boolean;
  /** False for a screen whose content fills the space itself, such as a map, instead of scrolling (Fm10 map view). */
  scroll?: boolean;
}

/**
 * A full Field screen on `surface` with the mobile top bar (wireframe `.tcx-mbar`), clear of the notch and the home
 * indicator. Right to left comes from the app: forced RTL on Android and iOS (expo-localization), `dir="rtl"` on
 * the web document.
 */
export function Screen({ title, leading, action, children, footer, tabbed = false, scroll = true }: ScreenProps) {
  const { color } = useTheme().theme;
  const insets = useSafeAreaInsets();
  const bottom = tabbed ? 0 : insets.bottom;

  return (
    <SafeAreaView testID="screen" edges={['top']} style={[styles.screen, { backgroundColor: color.surface }]}>
      <View style={[styles.bar, { borderBottomColor: color.border }]}>
        {leading}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[typography.title, styles.title, { color: color.ink }]}
        >
          {title}
        </Text>
        {action}
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, !footer && { paddingBottom: spacing.space7 + bottom }]}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
      {footer ? (
        <View
          testID="screen-footer"
          style={[styles.footer, { borderTopColor: color.border, paddingBottom: spacing.space6 + bottom }]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  bar: {
    height: size.headerH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space4,
    paddingHorizontal: spacing.space6,
    borderBottomWidth: 1,
  },
  title: { flex: 1 },
  content: { gap: spacing.space6, padding: spacing.space7 },
  footer: { gap: spacing.space4, padding: spacing.space6, borderTopWidth: 1 },
});
