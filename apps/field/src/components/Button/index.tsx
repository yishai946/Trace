import { radius, spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Icon, type IconName } from '../Icon';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** The action as a verb ("שלח דיווח"), also the screen reader name unless `accessibilityLabel` is given. */
  label: string;
  /** One `primary` per area; `danger` only for SOS. */
  variant?: 'secondary' | 'primary' | 'danger';
  /** `lg` is the mobile action button (`.tc-btn--lg`). */
  size?: 'md' | 'lg';
  /** Full width of its section (`.tc-btn--block`). */
  block?: boolean;
  icon?: IconName;
}

/** Trace Console Button for React Native. At least 44px high: the mobile touch target. */
export function Button({
  label,
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  disabled,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const { color } = useTheme().theme;
  const fill = { secondary: 'transparent', primary: color.primary, danger: color.danger }[variant];
  const ink = { secondary: color.ink, primary: color.onPrimary, danger: color.onDanger }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      aria-disabled={!!disabled}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        block && styles.block,
        {
          backgroundColor: pressed && variant === 'secondary' ? color.surfaceRaised : fill,
          borderColor: variant === 'secondary' ? color.borderStrong : 'transparent',
          opacity: disabled
            ? pendingTokens.disabledOpacity
            : pressed && variant !== 'secondary'
              ? pendingTokens.pressedOpacity
              : 1,
        },
      ]}
      {...props}
    >
      {icon ? <Icon name={icon} color={ink} large={size === 'lg'} /> : null}
      <Text style={[variant === 'secondary' ? typography.body : typography.bodyStrong, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: pendingTokens.touchTarget,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space3,
  },
  lg: { minHeight: pendingTokens.controlHLg, paddingHorizontal: spacing.space7 },
  block: { alignSelf: 'stretch' },
});
