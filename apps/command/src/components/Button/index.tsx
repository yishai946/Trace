import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import styles from './Button.module.css';

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'danger-ghost' | 'icon';

export interface ButtonProps extends AriaButtonProps {
  /** Trace Console Button: one `primary` per area; `danger` and `danger-ghost` only inside an SOS AlertBanner. */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], size === 'sm' && styles.sm, className].filter(Boolean).join(' ');
  return <AriaButton {...props} className={classes} />;
}
