import { ConnectionStatus, type Connection } from '../../components/ConnectionStatus';
import { ChevronIcon, MissionsListIcon, SignOutIcon } from '../../components/icons';
import { ROLE_LABELS, initials, type ProfileMenuProps } from '../../components/ProfileMenu';
import { ThemeSelect } from '../../components/ThemeSelect';
import styles from './MorePage.module.css';

export interface MorePageProps extends ProfileMenuProps {
  connection: Connection;
  onShowAllMissions: () => void;
}

/**
 * The "עוד" page of Command's phone layout (Cm16): the account details, the theme, the way back to all missions and sign-out.
 * The rows for the open mission's screens join it with those screens.
 */
export function MorePage({
  user,
  canSignOut,
  signingOut,
  signOutFailed,
  onSignOut,
  connection,
  onShowAllMissions,
}: MorePageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <h1 className={styles.title}>עוד</h1>
        <ConnectionStatus connection={connection} />
      </header>

      <section className={styles.list} aria-labelledby="more-account">
        <h2 id="more-account" className={styles.section}>
          חשבון
        </h2>

        <div className={`${styles.row} ${styles.large}`}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{user.name}</span>
            <span className={styles.meta}>{ROLE_LABELS[user.role]}</span>
            <span className={`${styles.meta} ${styles.email}`} dir="ltr">
              {user.email}
            </span>
          </span>
        </div>

        <div className={styles.row}>
          <ThemeSelect layout="row" />
        </div>

        <button type="button" className={`${styles.row} ${styles.action}`} onClick={onShowAllMissions}>
          <MissionsListIcon />
          <span className={styles.text}>כל המסעות</span>
          <ChevronIcon />
        </button>

        <button
          type="button"
          className={`${styles.row} ${styles.action} ${styles.danger}`}
          onClick={onSignOut}
          disabled={!canSignOut || signingOut}
        >
          <SignOutIcon />
          <span className={styles.text}>{signingOut ? 'יוצא…' : 'יציאה'}</span>
        </button>
        {!canSignOut && <p className={styles.note}>אפשר לצאת כשהחיבור יחזור.</p>}
        {signOutFailed && (
          <p className={styles.note} role="alert">
            היציאה נכשלה. נסו שוב.
          </p>
        )}
      </section>
    </div>
  );
}
