import type { SessionUser } from '@trace/schemas';
import { Button as AriaButton, Dialog, DialogTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components';
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

export interface SignOutProps {
  /** Signing out needs the server to revoke the session, so it waits for a connection. */
  canSignOut: boolean;
  signingOut: boolean;
  signOutFailed: boolean;
  onSignOut: () => void;
}

export interface ProfileMenuProps extends SignOutProps {
  user: SessionUser;
  /** `sheet` opens the panel as a bottom sheet over a veil, as on the phone (Cm17). */
  presentation?: 'popover' | 'sheet';
}

/** The avatar at the end of the AppBar. Opens the user's details, the theme choice and sign-out. */
export function ProfileMenu({ user, presentation = 'popover', ...signOut }: ProfileMenuProps) {
  const role = ROLE_LABELS[user.role];
  const panel = (
    <Dialog className={styles.dialog} aria-label="פרופיל">
      {presentation === 'sheet' && <div className={styles.grab} aria-hidden="true" />}
      <div className={styles.section}>
        <div className={styles.identity}>
          <span className={styles.avatar} data-static aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className={styles.who}>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.meta}>{role}</div>
            <div className={styles.email} dir="ltr">
              {user.email}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <ThemeSelect />
      </div>

      <div className={styles.section}>
        <SignOutButton {...signOut} />
      </div>
    </Dialog>
  );

  return (
    <DialogTrigger>
      <AriaButton className={styles.avatar} aria-label={`פרופיל: ${user.name}, ${role}`}>
        {initials(user.name)}
      </AriaButton>
      {presentation === 'sheet' ? (
        <ModalOverlay className={styles.veil} isDismissable>
          <Modal className={styles.sheet}>{panel}</Modal>
        </ModalOverlay>
      ) : (
        <Popover className={styles.popover} placement="bottom end" offset={8}>
          {panel}
        </Popover>
      )}
    </DialogTrigger>
  );
}

/** "יציאה": across the panel, disabled with a reason while offline, and an error when it fails. */
export function SignOutButton({ canSignOut, signingOut, signOutFailed, onSignOut }: SignOutProps) {
  return (
    <>
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
    </>
  );
}
