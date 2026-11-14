import type { Ref } from 'react';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import styles from './PhoneReportsPage.module.css';

interface ScreenBarProps {
  /** The heading takes focus when the card that had it goes away. */
  heading: Ref<HTMLHeadingElement>;
  connection: Connection;
}

/** The top bar of the phone Reports screen: its title and the connection light. */
export function ScreenBar({ heading, connection }: ScreenBarProps) {
  return (
    <header className={styles.bar}>
      <h1 ref={heading} tabIndex={-1} className={styles.title}>
        דיווחים
      </h1>
      <ConnectionStatus connection={connection} />
    </header>
  );
}
