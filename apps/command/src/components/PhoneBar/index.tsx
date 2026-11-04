import type { ReactNode } from 'react';
import styles from './PhoneBar.module.css';

/** The phone's top bar on screens without the map (wireframes Cm02, Cm16): a title, and at its end the status. */
export function PhoneBar({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className={styles.bar}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.end}>{children}</div>
    </header>
  );
}
