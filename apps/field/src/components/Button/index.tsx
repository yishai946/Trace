import { radius, spacing, typography } from '@trace/design';
import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge } from '../Badge';
import { Icon, type IconName } from '../Icon';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** The action as a verb ("שלח דיווח"), also the screen reader name unless `accessibilityLabel` is given. */
  label: string;
  /** One `primary` per area; `danger` only for SOS; `ghost` for a quiet secondary action (`.tc-btn--ghost`). */
  variant?: 'secondary' | 'primary' | 'danger' | 'ghost';
  /** `lg` is the mobile action button (`.tc-btn--lg`). */
  size?: 'md' | 'lg';
  /** Full width of its section (`.tc-btn--block`). */
  block?: boolean;
  icon?: IconName;
  /** A quiet word at the end of the button, such as "אופציונלי" (wireframe `.tcx-meta`). */
  trailing?: string;
  /** An accent count after the label, such as the reports of the polygon on the map (Fm06). */
  badge?: string;
}

/** Trace Console Button for React Native. At least 44px high: the mobile touch target. */
export function Button({
  label,
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  trailing,
  badge,
  disabled,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const { color } = useTheme().theme;
  const fill = { secondary: 'transparent', ghost: 'transparent', primary: color.primary, danger: color.danger }[
    variant
  ];
  const ink = {
    secondary: color.ink,
    ghost: color.inkSecondary,
    primary: color.onPrimary,
    danger: color.onDanger,
  }[variant];
  const quiet = variant === 'secondary' || variant === 'ghost';

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
          backgroundColor: pressed && quiet ? color.surfaceRaised : fill,
          borderColor: variant === 'secondary' ? color.borderStrong : 'transparent',
          opacity: disabled ? pendingTokens.disabledOpacity : pressed && !quiet ? pendingTokens.pressedOpacity : 1,
        },
      ]}
      {...props}
    >
      {icon ? <Icon name={icon} color={ink} large={size === 'lg'} /> : null}
      <Text style={[quiet ? typography.body : typography.bodyStrong, { color: ink }]}>{label}</Text>
      {badge ? <Badge tone="accent" label={badge} /> : null}
      {trailing ? <Text style={[typography.meta, styles.trailing, { color: color.inkMuted }]}>{trailing}</Text> : null}
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
  // Pushes the word to the end of the button, away from the label.
  trailing: { marginStart: 'auto' },
});
