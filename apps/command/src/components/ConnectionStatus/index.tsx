import styles from './ConnectionStatus.module.css';

export interface Connection {
  state: 'up' | 'down' | 'checking';
  /** One word, always on screen. */
  label: string;
  /** The reason and its effect, in the tooltip and the accessible name. */
  detail: string;
}

/** Trace Console ConnectionStatus: a dot and one word, always in the top bar before the avatar. */
export function ConnectionStatus({ connection }: { connection: Connection }) {
  return (
    <span
      className={styles.status}
      data-state={connection.state}
      role="status"
      title={connection.detail}
      aria-label={`${connection.label}. ${connection.detail}`}
    >
      <span className={styles.dot} aria-hidden="true" />
      {connection.label}
    </span>
  );
}
