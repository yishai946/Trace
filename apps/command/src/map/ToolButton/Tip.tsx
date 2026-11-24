import type { ReactNode } from 'react';
import { Tooltip, TooltipTrigger, type Placement } from 'react-aria-components';
import styles from './ToolButton.module.css';

interface TipProps {
  /** What the button does, shown on hover and focus. */
  label: string;
  placement?: Placement;
  /** One react-aria button. */
  children: ReactNode;
}

/** A label that appears when a map tool is hovered or focused. */
export function Tip({ label, placement = 'top', children }: TipProps) {
  return (
    <TooltipTrigger delay={300} closeDelay={0}>
      {children}
      <Tooltip className={styles.tooltip} placement={placement} offset={8}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
