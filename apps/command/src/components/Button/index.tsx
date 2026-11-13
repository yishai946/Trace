import {
  Button as AriaButton,
  Link as AriaLink,
  type ButtonProps as AriaButtonProps,
  type LinkProps as AriaLinkProps,
} from 'react-aria-components';
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
  /** The button element, for moving focus to it. */
  ref?: React.Ref<HTMLButtonElement>;
}

interface LookProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  className?: string;
}

function buttonClasses({ variant = 'secondary', size = 'md', className }: LookProps) {
  return [styles.button, styles[variant], size === 'sm' && styles.sm, size === 'lg' && styles.lg, className]
    .filter(Boolean)
    .join(' ');
}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <AriaButton {...props} className={buttonClasses({ variant, size, className: className as string })} />;
}

export interface LinkButtonProps extends Omit<AriaLinkProps, 'className'> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  className?: string;
}

/** A link that looks like a Button, for navigation such as `tel:`. Without an `href` it is disabled. */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <AriaLink {...props} className={buttonClasses({ variant, size, className })} />;
}
