import styles from './Button.module.css';

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'danger-ghost' | 'danger-outline' | 'icon';

export interface LookProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm' | 'lg';
  className?: string;
}

export function buttonClasses({ variant = 'secondary', size = 'md', className }: LookProps) {
  return [styles.button, styles[variant], size === 'sm' && styles.sm, size === 'lg' && styles.lg, className]
    .filter(Boolean)
    .join(' ');
}
