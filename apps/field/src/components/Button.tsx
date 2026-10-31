import { radius, spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '../theme/theme';

// TODO(design): the brand book requires 44px touch targets on mobile but has no token for it yet.
// Add a `touch-target` size token to the Trace Console artifact, run /sync-design, and use size.touchTarget here.
const TOUCH_TARGET = 44;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  /** One `primary` per screen; `danger` only for SOS. */
  variant?: 'secondary' | 'primary' | 'danger';
}

export function Button({ label, variant = 'secondary', disabled, ...props }: ButtonProps) {
  const { color } = useTheme().theme;
  const fill = { secondary: 'transparent', primary: color.primary, danger: color.danger }[variant];
  const ink = { secondary: color.ink, primary: color.onPrimary, danger: color.onDanger }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && variant === 'secondary' ? color.surfaceRaised : fill,
          borderColor: variant === 'secondary' ? color.borderStrong : 'transparent',
          opacity: disabled ? 0.45 : pressed && variant !== 'secondary' ? 0.8 : 1,
        },
      ]}
      {...props}
    >
      <Text style={[typography.bodyStrong, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
