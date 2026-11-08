import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import styles from './Button.module.css';

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'danger-ghost' | 'danger-outline' | 'icon';

export interface ButtonProps extends AriaButtonProps {
  /**
   * Trace Console Button: one `primary` per area. `danger` and `danger-ghost` belong in the SOS AlertBanner;
   * `danger-outline` is a destructive action elsewhere (delete, sign out), and `danger` confirms a delete.
   */
  variant?: ButtonVariant;
  /** `lg` is the large phone control (48px), for login and the main action of a phone screen. */
  size?: 'md' | 'sm' | 'lg';
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], size === 'sm' && styles.sm, size === 'lg' && styles.lg, className]
    .filter(Boolean)
    .join(' ');
  return <AriaButton {...props} className={classes} />;
}
