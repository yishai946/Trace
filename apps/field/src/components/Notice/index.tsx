import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';

/**
 * A short note on a form (wireframe `.tcx-banner`): neutral for information, `warn` with a warning border for a state
 * the searcher must not miss, such as a report that did not reach the commander. `live` announces it to a screen reader.
 * It is not AlertBanner, which is for SOS only.
 */
export function Notice({
  icon,
  tone = 'neutral',
  children,
  live = false,
}: {
  icon?: IconName;
  tone?: 'neutral' | 'warn';
  children: string;
  live?: boolean;
}) {
  const { color } = useTheme().theme;
  const warn = tone === 'warn';
  const ink = warn ? color.ink : color.inkSecondary;
  return (
    <View
      accessibilityRole={live ? 'alert' : undefined}
      accessibilityLiveRegion={live ? 'assertive' : undefined}
      style={[styles.box, { backgroundColor: color.surfaceRaised, borderColor: warn ? color.warning : color.border }]}
    >
      {icon ? <Icon name={icon} color={ink} /> : null}
      <Text
        style={[typography.meta, styles.text, { color: ink }, warn && { fontWeight: typography.bodyStrong.fontWeight }]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.space5,
    paddingVertical: spacing.space5,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
  text: { flex: 1 },
});
