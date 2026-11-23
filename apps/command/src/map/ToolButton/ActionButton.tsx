import type { ReactNode } from 'react';
import { Button, type ButtonProps } from 'react-aria-components';
import styles from './ToolButton.module.css';

export interface ActionButtonProps extends Omit<ButtonProps, 'children' | 'className'> {
  /** Icon-only buttons need a label for screen readers. */
  'aria-label': string;
  children: ReactNode;
}

/** A MapToolbar tool that does something once, with no pressed state (`ToolButton` is the toggle). */
export function ActionButton(props: ActionButtonProps) {
  return <Button {...props} className={styles.tool} />;
}
