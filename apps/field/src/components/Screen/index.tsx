import { size, spacing, typography } from '@trace/design';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export interface ScreenProps {
  /** Shown in the top bar and announced as the screen's heading. */
  title: string;
  /** Next to the title, at the end of the bar (e.g. "המסעות שלי" on the join screen). */
  action?: ReactNode;
  children: ReactNode;
  /** Pinned under the content, e.g. the screen's main action. */
  footer?: ReactNode;
}

/**
 * A full Field screen on `surface` with the mobile top bar (wireframe `.tcx-mbar`). Right to left comes from the
 * app: forced RTL on Android and iOS (expo-localization), `dir="rtl"` on the web document.
 * The mission tab bar, when there is one, is drawn by the tabs layout below it.
 */
export function Screen({ title, action, children, footer }: ScreenProps) {
  const { color } = useTheme().theme;

  return (
    <SafeAreaView
      testID="screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: color.surface }]}
    >
      <View style={[styles.bar, { borderBottomColor: color.border }]}>
        <Text accessibilityRole="header" numberOfLines={1} style={[typography.title, styles.title, { color: color.ink }]}>
          {title}
        </Text>
        {action}
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: color.border }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
