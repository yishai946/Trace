import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { buttonClasses, type ButtonVariant } from './buttonClasses';

export type { ButtonVariant };
export { LinkButton, type LinkButtonProps } from './LinkButton';

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

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <AriaButton {...props} className={buttonClasses({ variant, size, className: className as string })} />;
}
