import type { SessionUser } from '@trace/schemas';
import styles from './ProfileMenu.module.css';
import { Button } from '../Button';
import { SignOutIcon } from '../icons';
import { ThemeSelect } from '../ThemeSelect';

export const ROLE_LABELS: Record<SessionUser['role'], string> = { commander: 'מנהל מסע', searcher: 'מחפש שטח' };

/** Up to two letters from the user's name, for the avatar. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('');
}

export interface ProfileDetailsProps {
  user: SessionUser;
  canSignOut: boolean;
  signingOut: boolean;
  signOutFailed: boolean;
  onSignOut: () => void;
}

/** What the profile popover and the profile sheet hold: identity, the theme choice and sign-out. */
export function ProfileDetails({ user, canSignOut, signingOut, signOutFailed, onSignOut }: ProfileDetailsProps) {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.identity}>
          <span className={styles.avatar} data-static aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className={styles.who}>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.meta}>{ROLE_LABELS[user.role]}</div>
            <div className={styles.email} dir="ltr">
              {user.email}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <ThemeSelect layout="stacked" />
      </div>

      <div className={styles.section}>
        <Button
          variant="danger-outline"
          className={styles.signOut}
          onPress={onSignOut}
          isDisabled={!canSignOut || signingOut}
        >
          <SignOutIcon />
          {signingOut ? 'יוצא…' : 'יציאה'}
        </Button>
        {!canSignOut && <p className={styles.note}>אפשר לצאת כשהחיבור יחזור.</p>}
        {signOutFailed && (
          <p className={styles.note} role="alert">
            היציאה נכשלה. נסו שוב.
          </p>
        )}
      </div>
    </>
  );
}
