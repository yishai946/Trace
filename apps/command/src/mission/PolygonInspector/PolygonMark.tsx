import type { PolygonStatus } from '@trace/schemas';
import styles from './PolygonInspector.module.css';

/** The polygon icon in the Inspector's head, tinted by the polygon's status. */
export function PolygonMark({ status }: { status: PolygonStatus }) {
  return (
    <span className={styles.mark} data-status={status} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M5 6l7-3 8 5-2 10-11 2-3-8z" />
      </svg>
    </span>
  );
}
