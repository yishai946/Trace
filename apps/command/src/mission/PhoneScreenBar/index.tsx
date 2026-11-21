import type { Ref } from 'react';
import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import styles from './PhoneScreenBar.module.css';

interface PhoneScreenBarProps {
  title: string;
  connection: Connection;
  /** The heading takes focus when the card that had it goes away. */
  heading?: Ref<HTMLHeadingElement>;
}

/** The top bar of a phone screen (Cm10, Cm11): its title and the connection light. */
export function PhoneScreenBar({ title, connection, heading }: PhoneScreenBarProps) {
  return (
    <header className={styles.bar}>
      <h1 ref={heading} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      <ConnectionStatus connection={connection} />
    </header>
  );
}
