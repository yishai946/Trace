import type { ReactNode } from 'react';
import { Button, type ButtonProps, type Placement } from 'react-aria-components';
import styles from './ToolButton.module.css';
import { Tip } from './Tip';

export interface ActionButtonProps extends Omit<ButtonProps, 'children' | 'className'> {
  /** Icon-only buttons need a label for screen readers; it is also the hover label. */
  'aria-label': string;
  children: ReactNode;
  /** The larger map control size. */
  large?: boolean;
  /** The action is under way (such as finding a position): a spinner replaces the icon. */
  isPending?: boolean;
  tipPlacement?: Placement;
}

/** A MapToolbar tool that does something once, with no pressed state (`ToolButton` is the toggle). */
export function ActionButton({ large, isPending, tipPlacement, children, ...props }: ActionButtonProps) {
  return (
    <Tip label={props['aria-label']} placement={tipPlacement}>
      <Button {...props} isPending={isPending} className={`${styles.tool} ${large ? styles.large : ''}`}>
        {isPending ? <span className={styles.spinner} aria-hidden="true" /> : children}
      </Button>
    </Tip>
  );
}
