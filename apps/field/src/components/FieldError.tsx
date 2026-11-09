import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/** The one message under a field (`.tc-field__error`): a warning box that announces itself and does not block a retry. */
export function FieldError({ message }: { message: string }) {
  const { color } = useTheme().theme;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderColor: color.warning }]}
    >
      <Icon name="alert" color={color.warning} />
      <Text style={[typography.meta, styles.text, { color: color.ink }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space5,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
  },
  text: { flex: 1 },
});
