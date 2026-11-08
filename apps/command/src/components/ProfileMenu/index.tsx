import type { SessionUser } from '@trace/schemas';
import { Button as AriaButton, Dialog, DialogTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components';
import styles from './ProfileMenu.module.css';
import { ProfileDetails, ROLE_LABELS, initials } from './ProfileDetails';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';

export { ROLE_LABELS, initials };

export interface ProfileMenuProps {
  user: SessionUser;
  /** Signing out needs the server to revoke the session, so it waits for a connection. */
  canSignOut: boolean;
  signingOut: boolean;
  signOutFailed: boolean;
  onSignOut: () => void;
}

/**
 * The avatar at the end of the AppBar. Opens the user's details, the theme choice and sign-out:
 * a popover on desktop, a bottom sheet on a phone (Trace Console ProfileMenu guidelines).
 */
export function ProfileMenu(props: ProfileMenuProps) {
  const phone = usePhoneLayout();
  const { user } = props;
  const role = ROLE_LABELS[user.role];

  return (
    <DialogTrigger>
      <AriaButton className={styles.avatar} aria-label={`פרופיל: ${user.name}, ${role}`}>
        {initials(user.name)}
      </AriaButton>
      {phone ? (
        <ModalOverlay className={styles.overlay} isDismissable>
          <Modal className={styles.sheet}>
            <Dialog className={styles.dialog} data-presentation="sheet" aria-label="פרופיל">
              <div className={styles.grab} aria-hidden="true" />
              <ProfileDetails {...props} />
            </Dialog>
          </Modal>
        </ModalOverlay>
      ) : (
        <Popover className={styles.popover} placement="bottom end" offset={8}>
          <Dialog className={styles.dialog} data-presentation="popover" aria-label="פרופיל">
            <ProfileDetails {...props} />
          </Dialog>
        </Popover>
      )}
    </DialogTrigger>
  );
}
