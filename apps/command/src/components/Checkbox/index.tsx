import type { ReactNode } from 'react';
import { Checkbox as AriaCheckbox, type CheckboxProps } from 'react-aria-components';
import styles from './Checkbox.module.css';

const checkIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/** A checkbox with its label (Trace Console Checkbox: `checkbox` and `check-icon` sizes). */
export function Checkbox({ children, className, ...props }: Omit<CheckboxProps, 'children'> & { children: ReactNode }) {
  return (
    <AriaCheckbox {...props} className={[styles.check, className].filter(Boolean).join(' ')}>
      <span className={styles.box}>{checkIcon}</span>
      {children}
    </AriaCheckbox>
  );
}
