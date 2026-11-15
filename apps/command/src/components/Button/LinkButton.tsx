import { Link as AriaLink, type LinkProps as AriaLinkProps } from 'react-aria-components';
import { buttonClasses, type ButtonVariant } from './buttonClasses';

export interface LinkButtonProps extends Omit<AriaLinkProps, 'className'> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  className?: string;
}

/** A link that looks like a Button, for navigation such as `tel:`. Without an `href` it is disabled. */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <AriaLink {...props} className={buttonClasses({ variant, size, className })} />;
}
