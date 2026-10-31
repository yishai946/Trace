import type { ReactNode } from 'react';
import { ToggleButton, type ToggleButtonProps } from 'react-aria-components';
import styles from './ToolButton.module.css';

export interface ToolButtonProps extends Omit<ToggleButtonProps, 'children' | 'className'> {
  /** Icon-only buttons need a label for screen readers. */
  'aria-label': string;
  children: ReactNode;
}

/** Trace Console icon button with a pressed state (MapToolbar tools). */
export function ToolButton(props: ToolButtonProps) {
  return <ToggleButton {...props} className={styles.tool} />;
}
