import { spacing, typography } from '@trace/design';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Steps } from '../Steps';
import { TraceMark } from '../TraceMark';

export interface AuthLayoutProps {
  heading: string;
  /** The stepper; left out when the screen is a step of nothing, such as the name on first sign-in. */
  steps?: { labels: string[]; current: number };
  /** The fields. */
  children: ReactNode;
  /** The actions at the bottom: one primary button. */
  footer: ReactNode;
}

/** The frame of the sign-in screens (Fm01): brand, stepper, heading, fields, and the actions pinned to the bottom. */
export function AuthLayout({ heading, steps, children, footer }: AuthLayoutProps) {
  const { color } = useTheme().theme;
  return (
    <SafeAreaView
      testID="auth-layout"
      edges={['top', 'bottom']}
      style={[styles.fill, { backgroundColor: color.surface }]}
    >
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <TraceMark color={color.ink} />
            <Text style={[typography.title, { color: color.ink }]}>TRACE Field</Text>
            <Text style={[typography.meta, { color: color.inkMuted }]}>מחפש שטח</Text>
          </View>
          {steps ? (
            <View style={styles.steps}>
              <Steps steps={steps.labels} current={steps.current} />
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[typography.title, styles.heading, { color: color.ink }]}>
            {heading}
          </Text>
          <View style={styles.fields}>{children}</View>
          <View style={styles.spacer} />
          <View style={styles.footer}>
            {footer}
            <Text style={[typography.caption, styles.caption, { color: color.inkMuted }]}>
              אחרי הכניסה המצב נשמר, ואין צורך להתחבר שוב
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: spacing.space7 * 2,
    paddingHorizontal: spacing.space7,
    paddingBottom: spacing.space7,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  steps: { marginTop: spacing.space7 + spacing.space4 },
  heading: { marginTop: spacing.space7 },
  fields: { gap: spacing.space6, marginTop: spacing.space6 },
  spacer: { flex: 1 },
  footer: { gap: spacing.space4, paddingTop: spacing.space7 },
  caption: { textAlign: 'center', paddingTop: spacing.space1 },
});
